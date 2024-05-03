import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useParams } from "react-router-dom";
import { ClearOutlined, DownloadOutlined } from "@ant-design/icons";
import { fabric } from "fabric";
import { FabricJSCanvas, useFabricJSEditor } from "fabricjs-react";
import { BsBrush } from "react-icons/bs";
import { FaRegCircle } from "react-icons/fa";
import { BiRectangle, BiUndo, BiRedo } from "react-icons/bi";
import { RiDeleteBinLine } from "react-icons/ri";
import { AiOutlineUserSwitch } from "react-icons/ai";
import { IoTriangleOutline } from "react-icons/io5";
import { TfiLayoutLineSolid } from "react-icons/tfi";
import ToolButton from "./ToolButton";
import { InputNumber, Statistic, Col } from "antd";
import { createGeometryShape } from "../utils/createGeometryShape";
import { useSelector } from "react-redux";
import exportCanvasToJPEG from "../utils/exoprtCanvasToJPEG";

export default function Board() {
  const { editor, onReady } = useFabricJSEditor();
  const [color, setColor] = useState("#000");
  const [isDrawing, setIsDrawing] = useState(false);
  const [isRoomInfo, setIsRoomInfo] = useState(false);
  const [brushSize, setBrushSize] = useState();
  const [userCount, setUserCount] = useState(0);

  const [actions, setActions] = useState([]);
  const [participants, setParticipants] = useState([]);

  const { id } = useParams();
  const socket = io("http://localhost:8000");
  const userNameFromState = useSelector((state) => state.users.userName);

  const updateEventList = [
    "object:modified",
    "object:added",
    "object:removed",
    "object:moved",
  ];

  const update = () => {
    console.log("canvas updated");
    const data = editor.canvas.toJSON();
    const preview = editor.canvas.toDataURL();
    socket.emit("canvas-state", {
      boardId: id,
      canvasData: data,
      previewData: preview,
    });
  };

  const addUpdateEvents = () => {
    updateEventList.forEach((event) => {
      editor.canvas.on(event, () => {
        update();
      });
    });
  };

  const removeUpdateEvents = () => {
    updateEventList.forEach((event) => {
      editor.canvas.off(event);
    });
  };

  useEffect(() => {
    if (!editor || !fabric) {
      return;
    }
    editor.canvas.freeDrawingBrush.color = color;
    editor.canvas.freeDrawingBrush.width = brushSize;
    editor.setStrokeColor(color);
  }, [color, brushSize]);

  const onAddCircle = () => {
    const { shape: circle } = createGeometryShape({
      canvas: editor.canvas,
      shapeType: "circle",
      color,
    });

    editor.canvas.add(circle);
  };

  const onAddRectangle = () => {
    const { shape: rectangle } = createGeometryShape({
      canvas: editor.canvas,
      shapeType: "rect",
      color,
    });

    editor.canvas.add(rectangle);
  };

  const onAddLine = () => {
    const { shape: line } = createGeometryShape({
      canvas: editor.canvas,
      shapeType: "line",
      color,
    });

    editor.canvas.add(line);
  };

  const onAddTriangle = () => {
    const { shape: triangle } = createGeometryShape({
      canvas: editor.canvas,
      shapeType: "triangle",
      color,
    });

    editor.canvas.add(triangle);
  };

  const toggleDrawingMode = () => {
    editor.canvas.isDrawingMode = !editor.canvas.isDrawingMode;
    setIsDrawing(!isDrawing);
  };

  const onSizeChange = (value) => {
    setBrushSize(value);
  };

  const history = [];

  const undo = () => {
    if (editor.canvas._objects.length > 0) {
      const removedObject = editor.canvas._objects.pop();
      history.push(removedObject);
      update();
    }
    editor.canvas.renderAll();
  };

  const redo = () => {
    if (history.length > 0) {
      const restoredObject = history.pop();
      editor.canvas.add(restoredObject);
      update();
    }
  };

  const clear = () => {
    socket.emit("clear", { boardId: id });
  };

  const removeSelectedObject = () => {
    editor.canvas.remove(editor.canvas.getActiveObject());
  };

  const handleExportCanvas = () => {
    exportCanvasToJPEG(editor.canvas);
  };

  useEffect(() => {
    if (!editor || !editor.canvas) {
      return;
    }
    removeUpdateEvents();
    addUpdateEvents();

    socket.on("connect", () => {
      console.log("Connected to server");
      socket.emit("client-ready", id);
    });

    socket.on("participantsList", (participantsList) => {
      setParticipants(participantsList);
    });

    socket.emit("joinRoom", id, userNameFromState);

    socket.on("userJoined", ({ userName }) => {
      const joinMessage =
        userName === userNameFromState
          ? "You have joined the room."
          : `${userName} joined the room.`;
      setActions((prevActions) => [...prevActions, joinMessage]);
    });

    socket.on("participantsCount", (count) => {
      setUserCount(count);
    });

    window.addEventListener("beforeunload", () => {
      socket.emit("leaveRoom", id, userNameFromState);
    });

    socket.on("canvas-state-from-server", (state) => {
      removeUpdateEvents();
      editor.canvas.loadFromJSON(
        state,
        editor.canvas.renderAll.bind(editor.canvas)
      );
      addUpdateEvents();
    });

    socket.on("clear", () => {
      editor.canvas._objects.splice(0, editor.canvas._objects.length);
      history.splice(0, history.length);
      editor.canvas.renderAll();
    });

    socket.on("userLeft", ({ userName }) => {
      const leaveMessage = `${userName} leaves the room.`;
      setActions((prevActions) => [...prevActions, leaveMessage]);
      socket.on("participantsList", (participantsList) => {
        setParticipants(participantsList);
      });
      console.log(`${userName} покидает комнату`);
    });

    return () => {
      removeUpdateEvents();
      socket.disconnect();
      socket.off("canvas-state-from-server");
      socket.off("clear");
      socket.off("participantsList");
      socket.off("participantsCount");
    };
  }, [editor, id]);

  return (
    <div className="relative w-screen h-screen flex justify-center items-center">
      <AiOutlineUserSwitch
        className="absolute top-2 right-8 z-10 cursor-pointer text-black hover:text-orange-500 text-5xl"
        title="Room information"
        onClick={() => setIsRoomInfo(!isRoomInfo)}
      />
      {isRoomInfo && (
        <div className="max-h-72 fixed top-5 right-0 m-6 p-4 bg-transparent bg-opacity-80 rounded-lg z-20 overflow-auto">
          <h3 className="text-xl font-semibold text-black mb-2">Users</h3>
          <ul className="divide-y divide-gray-700 overflow-auto">
            {participants.map((participant, index) => (
              <li key={index} className="py-1">
                <span className="text-green-500">● </span>
                <span className="text-black">{participant}</span>
              </li>
            ))}
          </ul>
          <h3 className="text-xl font-semibold text-black mt-4 mb-2 overflow-auto">
            Info
          </h3>
          <ul className="divide-y divide-gray-700">
            {actions.map((action, index) => (
              <li key={index} className="py-1">
                <span className="text-black">{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="absolute top-0 left-0 flex flex-col justify-start items-center gap-3 mb-2 p-4 z-10">
        <ToolButton title="Select color">
          <label className="inline-block">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className=" h-9 w-9"
            />
          </label>
        </ToolButton>
        <ToolButton handleEvent={clear}>
          <ClearOutlined
            className="text-black hover:text-orange-500 text-3xl"
            title="Clear all"
          />
        </ToolButton>
        <ToolButton handleEvent={toggleDrawingMode}>
          <BsBrush
            className={`${
              isDrawing ? "text-orange-500" : "text-black"
            } text-3xl hover:text-orange-500`}
            title="Brush"
          />
        </ToolButton>
        {isDrawing && (
          <InputNumber
            size="small"
            min={1}
            max={10}
            defaultValue={3}
            onChange={onSizeChange}
            changeOnWheel
            className="hover:border-orange-500 w-12 border-transparent text-center focus:border-orange-500 transition-all duration-300"
          />
        )}
        <ToolButton handleEvent={onAddLine}>
          <div style={{ transform: "rotate(45deg)" }}>
            <TfiLayoutLineSolid
              className="text-black hover:text-orange-500 text-3xl"
              title="Line"
            />
          </div>
        </ToolButton>
        <ToolButton handleEvent={onAddCircle}>
          <FaRegCircle
            className="text-black hover:text-orange-500 text-3xl"
            title="Circle"
          />
        </ToolButton>
        <ToolButton handleEvent={onAddRectangle}>
          <BiRectangle
            className="text-black hover:text-orange-500 text-3xl"
            title="Rectangle"
          />
        </ToolButton>
        <ToolButton handleEvent={onAddTriangle}>
          <IoTriangleOutline
            className="text-black hover:text-orange-500 text-3xl"
            title="Circle"
          />
        </ToolButton>
        <ToolButton handleEvent={removeSelectedObject}>
          <RiDeleteBinLine
            className="text-black hover:text-orange-500 text-3xl"
            title="Remove item"
          />
        </ToolButton>
        <div className="flex gap-1">
          <ToolButton handleEvent={undo}>
            <BiUndo
              className="text-black hover:text-orange-500 text-3xl"
              title="Undo"
            />
          </ToolButton>
          <ToolButton handleEvent={redo}>
            <BiRedo
              className="text-black hover:text-orange-500 text-3xl"
              title="Redo"
            />
          </ToolButton>
        </div>
        <ToolButton handleEvent={handleExportCanvas}>
          <DownloadOutlined
            className="text-black hover:text-orange-500 text-3xl"
            title="Export to JPEG"
          />
        </ToolButton>
      </div>
      <Col className="absolute bottom-0 left-0 p-3" span={12}>
        <Statistic title="Active Users" value={userCount} />
      </Col>
      <FabricJSCanvas
        className="sample-canvas border h-screen w-screen border-black"
        onReady={onReady}
      />
    </div>
  );
}

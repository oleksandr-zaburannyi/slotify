import "@ant-design/v5-patch-for-react-19";
import React from "react";
import "./index.css";
import App from "./App";
import ReactDOM from "react-dom/client";

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container!);
root.render(<App key={"app"} />);

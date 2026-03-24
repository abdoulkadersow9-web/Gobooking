const React = require("react");
const { View, Text } = require("react-native");

function MapView({ style, children }) {
  return React.createElement(
    View,
    { style: [{ backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }, style] },
    React.createElement(Text, { style: { color: "#6b7280", fontSize: 14 } }, "Carte non disponible sur web"),
    children
  );
}

function Marker() { return null; }
function Polyline() { return null; }
function Circle() { return null; }
function Callout() { return null; }

const PROVIDER_DEFAULT = null;
const PROVIDER_GOOGLE = "google";

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Marker;
module.exports.Polyline = Polyline;
module.exports.Circle = Circle;
module.exports.Callout = Callout;
module.exports.PROVIDER_DEFAULT = PROVIDER_DEFAULT;
module.exports.PROVIDER_GOOGLE = PROVIDER_GOOGLE;

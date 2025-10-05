import React from "react";
import "../App.css";

const PopupIntro = ({ onClose }) => {
  return (
    <div className="popup-intro-overlay">
      <div className="popup-intro">
        <h2>Bienvenido a Tick-Tick Bloom</h2>
        <p>
          Esta aplicación te ayuda a decidir cuándo sembrar y cosechar tus plantas usando mapas y datos satelitales.<br/>
          El NDVI es un indicador que muestra la salud y vigor de tus cultivos, ayudándote a tomar mejores decisiones.<br/>
          ¡No necesitas conocimientos técnicos, solo selecciona tu región y explora los consejos!
        </p>
        <button onClick={onClose}>Entendido</button>
      </div>
    </div>
  );
};

export default PopupIntro;

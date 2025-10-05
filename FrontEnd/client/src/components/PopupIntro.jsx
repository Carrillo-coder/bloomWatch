import React from "react";
import "../App.css";

const PopupIntro = ({ onClose }) => {
  return (
    <div className="popup-intro-overlay">
      <div className="popup-intro">
        <h2>Welcome to Bloom-it</h2>
        <p>
          This application helps you decide when to plant and take care of your crops using maps and satellite data.<br/>
           NDVI is an indicator that shows the health and vigor of your crops, helping you make better decisions.<br/>
           You don't need technical knowledge—just select your region and explore the recommendations!
        </p>
        <button onClick={onClose}>Understood</button>
      </div>
    </div>
  );
};

export default PopupIntro;

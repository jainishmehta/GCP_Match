import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './ResultsPage.css';

const ResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const { uploadedImageUrl, closestImageUrl, message } = location.state || {};

  if (!location.state || !uploadedImageUrl || !closestImageUrl) {
    return (
      <div className="error-container">
        <h2>No results available</h2>
        <p>Please upload an image first</p>
        <button 
          className="return-button"
          onClick={() => navigate('/')}
        >
          Return to Upload
        </button>
      </div>
    );
  }

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = '/placeholder-image.jpg';
    console.error('Image failed to load:', e.target.src);
  };

  const handleImageLoad = () => {
    setImagesLoaded(true);
  };

  return (
    <div className="results-container">
      <h1 className="page-title">Fashion Match Results</h1>
      
      {!imagesLoaded && (
        <div className="loading-spinner">
          Loading results...
        </div>
      )}
      
      <div className="image-comparison" style={{ opacity: imagesLoaded ? 1 : 0 }}>
        <div className="image-card">
          <h2 className="image-title">Your Image</h2>
          <div className="image-wrapper">
            <img 
              src={uploadedImageUrl} 
              alt="Uploaded fashion item" 
              className="result-image"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </div>
        </div>

        <div className="image-card">
          <h2 className="image-title">Best Match</h2>
          <div className="image-wrapper">
            <img 
              src={closestImageUrl} 
              alt="Matching fashion item" 
              className="result-image"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </div>
        </div>
      </div>

      {message && (
        <div className="message-container">
          <p className="result-message">{message}</p>
        </div>
      )}

      <div className="actions-container">
        <button 
          className="action-button"
          onClick={() => navigate('/')}
        >
          Upload Another Image
        </button>
      </div>
    </div>
  );
};

export default ResultsPage;
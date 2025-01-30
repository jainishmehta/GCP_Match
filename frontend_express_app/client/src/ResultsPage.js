import { useLocation } from 'react-router-dom';
import './ResultsPage.css'; // Create this CSS file

const ResultsPage = () => {
  const location = useLocation();
  const { uploadedImageUrl, closestImageUrl } = location.state || {};

  // Handle potential missing state or image errors
  if (!location.state) {
    return (
      <div className="error-message">
        <h2>No results found. Please upload an image first.</h2>
      </div>
    );
  }

  const handleImageError = (e) => {
    e.target.onerror = null; // Prevent infinite loop
    e.target.src = '/placeholder-image.jpg'; // Add a placeholder image in public folder
  };

  return (
    <div className="results-container">
      <h1 className="page-title">Matching Results</h1>
      
      <div className="image-comparison">
        <div className="image-card">
          <h2 className="image-title">Your Uploaded Image</h2>
          <div className="image-wrapper">
            <img 
              src={uploadedImageUrl} 
              alt="Uploaded content" 
              className="result-image"
              onError={handleImageError}
            />
          </div>
        </div>

        <div className="image-card">
          <h2 className="image-title">Best Match Found</h2>
          <div className="image-wrapper">
            <img 
              src={closestImageUrl} 
              alt="Closest match" 
              className="result-image"
              onError={handleImageError}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
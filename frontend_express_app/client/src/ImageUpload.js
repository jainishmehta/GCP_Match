import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ImageUpload.css'; // Create this CSS file

const ImageUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('http://localhost:5000/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed. Please try again.');
      
      const result = await response.json();
      navigate('/results', { state: result });

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-card">
        <div className="header">
          <svg className="upload-icon" viewBox="0 0 24 24">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
          </svg>
          <h1 className="title">Upload Your Fashion Image</h1>
          <p className="subtitle">PNG, JPG, or WEBP (Max 5MB)</p>
        </div>

        <form onSubmit={handleUpload} className="upload-form">
          <div className="file-input-container">
            <input 
              type="file" 
              id="file-input"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden-input"
            />
            <label htmlFor="file-input" className="file-label">
              {file ? (
                <>
                  <svg className="file-icon" viewBox="0 0 24 24">
                    <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>
                  </svg>
                  {file.name}
                </>
              ) : (
                'Choose File'
              )}
            </label>
          </div>

          {file && (
            <div className="preview-container">
              <img 
                src={URL.createObjectURL(file)} 
                alt="Preview" 
                className="image-preview"
              />
            </div>
          )}

          <button 
            type="submit" 
            className="upload-button"
            disabled={!file || loading}
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              'Find Matching Fashion'
            )}
          </button>

          {error && <div className="error-message">{error}</div>}
        </form>
      </div>
    </div>
  );
};

export default ImageUpload;
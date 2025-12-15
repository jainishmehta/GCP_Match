import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './ImageUpload.css';

const ImageUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && !selectedFile.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setFile(selectedFile);
    setError(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
    //   const API_URL = 'http://localhost:10000';
      const API_URL = 'https://gcp-match.onrender.com'; 
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors'
      });

      if (!response.ok) {
        let errorMsg = 'Upload failed';
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch {}
        throw new Error(errorMsg);
      }

      const result = await response.json();
      navigate('/results', { 
        state: { 
          uploadedImageUrl: URL.createObjectURL(file),
          closestImageUrl: result.closestImageUrl,
          message: result.message
        }
      });

    } catch (error) {
      setError(error.message || 'Failed to upload image');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <div className="upload-card">
        <div className="header">
          <h1 className="title">Upload Your Fashion Image</h1>
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
              {file ? file.name : 'Choose File'}
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
            {loading ? <div className="spinner"></div> : 'Find Matching Fashion'}
          </button>
          {error && <div className="error-message">{error}</div>}
        </form>
      </div>
    </div>
  );
};

export default ImageUpload;
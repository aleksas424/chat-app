const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation error',
      errors: err.errors
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      message: 'Unauthorized access'
    });
  }

  if (err.name === 'ForbiddenError') {
    return res.status(403).json({
      message: 'Forbidden access'
    });
  }

  if (err.name === 'NotFoundError') {
    return res.status(404).json({
      message: 'Resource not found'
    });
  }

  // Handle database errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      message: 'Duplicate entry'
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW') {
    return res.status(400).json({
      message: 'Referenced resource does not exist'
    });
  }

  // Handle file upload errors
  if (err.name === 'FileUploadError') {
    return res.status(400).json({
      message: err.message || 'File upload failed'
    });
  }

  // Handle socket errors
  if (err.name === 'SocketError') {
    return res.status(500).json({
      message: 'Socket connection error'
    });
  }

  // Default error
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
};

module.exports = errorHandler; 
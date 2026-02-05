"""
rembg API Server
Simple Flask server for background removal using rembg
"""

from flask import Flask, request, Response, jsonify
from rembg import remove, new_session
import io
import time
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Pre-load model on startup
logger.info("Loading rembg model...")
session = new_session("u2netp")
logger.info("Model loaded successfully")


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'model': 'u2netp'})


@app.route('/remove-background', methods=['POST'])
def remove_background():
    """
    Remove background from image
    
    Expects: multipart/form-data with 'image' file
    Returns: PNG image with transparent background
    """
    start_time = time.time()
    
    # Check if image is provided
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    try:
        # Read input image
        input_data = request.files['image'].read()
        input_size_kb = len(input_data) / 1024
        logger.info(f"Processing image: {input_size_kb:.1f} KB")
        
        # Remove background
        output_data = remove(input_data, session=session)
        
        # Calculate stats
        duration_ms = int((time.time() - start_time) * 1000)
        output_size_kb = len(output_data) / 1024
        logger.info(f"Done: {duration_ms}ms, output: {output_size_kb:.1f} KB")
        
        # Return PNG with transparent background
        return Response(
            output_data,
            mimetype='image/png',
            headers={
                'X-Processing-Time-Ms': str(duration_ms),
                'X-Input-Size-Kb': str(int(input_size_kb)),
                'X-Output-Size-Kb': str(int(output_size_kb)),
            }
        )
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/', methods=['GET'])
def index():
    """Root endpoint with API info"""
    return jsonify({
        'service': 'rembg-api',
        'version': '1.0.0',
        'model': 'u2netp',
        'endpoints': {
            '/health': 'GET - Health check',
            '/remove-background': 'POST - Remove background (multipart/form-data with image file)',
        }
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)

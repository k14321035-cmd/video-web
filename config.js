const AppConfig = (() => {
    // Change this to your Render URL after deployment, e.g., 'https://your-app.onrender.com'
    const API_BASE_URL = 'https://video-web-y4uc.onrender.com/'; 

    return {
        apiBaseUrl: API_BASE_URL,
        // Helper to construct full API URLs
        apiUrl: (path) => `${API_BASE_URL}${path}`
    };
})();

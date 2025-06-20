document.addEventListener('DOMContentLoaded', () => {
    const xerFileInput = document.getElementById('xerFile');
    const uploadBtn = document.getElementById('uploadBtn');
    const statusMessageDiv = document.getElementById('statusMessage');

    uploadBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        statusMessageDiv.classList.add('hidden'); // Hide previous message
        statusMessageDiv.textContent = '';
        statusMessageDiv.classList.remove('bg-green-100', 'text-green-800', 'border-green-300', 'bg-red-100', 'text-red-800', 'border-red-300');


        const file = xerFileInput.files[0];

        // Validation
        if (!file) {
            showStatus('Please select a file.', 'error');
            return;
        }
        if (!file.name.toLowerCase().endsWith('.xer')) {
             showStatus('Invalid file type. Please select a .xer file.', 'error');
            return;
        }

        // Prepare for upload
        const formData = new FormData();
        formData.append('xerFile', file); // Key must match multer field name

        uploadBtn.disabled = true;
        showStatus(`Uploading ${file.name}...`, 'info');

        try {
            const response = await fetch('/api/xer/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json(); // Always expect JSON

            if (!response.ok) {
                // Handle HTTP errors (like 500 from server)
                throw new Error(result.error || `Server error: ${response.status}`);
            }

            // Handle application-level success/failure indicated in JSON
            if (result.success) {
                showStatus(`Success: ${result.message || 'File processed successfully.'}`, 'success');
                xerFileInput.value = ''; // Clear the file input
            } else {
                showStatus(`Processing Error: ${result.message || 'Unknown error during processing.'}`, 'error');
            }

        } catch (error) {
            console.error('Upload Error:', error);
            showStatus(`Upload Failed: ${error.message}`, 'error');
        } finally {
            uploadBtn.disabled = false;
        }
    });

    function showStatus(message, type = 'info') {
        statusMessageDiv.textContent = message;
        statusMessageDiv.classList.remove('hidden');
        statusMessageDiv.classList.remove('bg-green-100', 'text-green-800', 'border-green-300', 'bg-red-100', 'text-red-800', 'border-red-300', 'bg-blue-100', 'text-blue-800', 'border-blue-300'); // Clear old styles

        if (type === 'success') {
            statusMessageDiv.classList.add('bg-green-100', 'text-green-800', 'border', 'border-green-300');
        } else if (type === 'error') {
             statusMessageDiv.classList.add('bg-red-100', 'text-red-800', 'border', 'border-red-300');
        } else { // Info
             statusMessageDiv.classList.add('bg-blue-100', 'text-blue-800', 'border', 'border-blue-300');
        }
    }
}); 
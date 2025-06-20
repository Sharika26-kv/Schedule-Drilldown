// BIM_XER_Masher - Main Application JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // File upload elements
    const ifcDropzone = document.getElementById('ifc-dropzone');
    const xerDropzone = document.getElementById('xer-dropzone');
    const ifcFileInput = document.getElementById('ifc-file');
    const xerFileInput = document.getElementById('xer-file');
    const ifcUploadBtn = document.getElementById('ifc-upload-btn');
    const xerUploadBtn = document.getElementById('xer-upload-btn');
    const ifcFileName = document.getElementById('ifc-file-name');
    const xerFileName = document.getElementById('xer-file-name');
    const processFilesBtn = document.getElementById('process-files-btn');
    
    // Status display elements
    const ifcUploadStatusContainer = document.getElementById('ifc-upload-status-container');
    const ifcUploadStatus = document.getElementById('ifc-upload-status');
    const translationContainer = document.getElementById('translation-container');
    const translationStatus = document.getElementById('translation-status');
    const translationProgress = document.getElementById('translation-progress');
    const notifications = document.getElementById('notifications');
    
    // Global variables to track file upload status
    let ifcFile = null;
    let xerFile = null;
    
    // Function to update process button state
    function updateProcessButtonState() {
        if (ifcFile && xerFile) {
            processFilesBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
            processFilesBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
            processFilesBtn.disabled = false;
        } else {
            processFilesBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
            processFilesBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
            processFilesBtn.disabled = true;
        }
    }
    
    // Function to show status elements
    function showStatus(element, text) {
        if (element) {
            element.textContent = text;
            
            // For container elements, show/hide as needed
            if (element === ifcUploadStatus) {
                ifcUploadStatusContainer.classList.remove('hidden');
            } else if (element === translationStatus) {
                translationContainer.classList.remove('hidden');
            }
        }
    }
    
    // Function to update translation progress
    function updateTranslationProgress(percent) {
        if (translationProgress) {
            translationProgress.style.width = `${percent}%`;
            translationContainer.classList.remove('hidden');
        }
    }
    
    // Function to show error notification
    function showError(message) {
        if (notifications) {
            notifications.innerHTML = `
                <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
                    <p>${message}</p>
                </div>
            `;
            notifications.classList.remove('hidden');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                notifications.classList.add('hidden');
            }, 5000);
        }
    }
    
    // Function to show success notification
    function showSuccess(message) {
        if (notifications) {
            notifications.innerHTML = `
                <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4">
                    <p>${message}</p>
                </div>
            `;
            notifications.classList.remove('hidden');
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                notifications.classList.add('hidden');
            }, 5000);
        }
    }
    
    // IFC file upload handling
    ifcUploadBtn.addEventListener('click', function() {
        ifcFileInput.click();
    });
    
    ifcFileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            ifcFile = e.target.files[0];
            ifcFileName.textContent = ifcFile.name;
            ifcDropzone.classList.add('border-green-500', 'bg-green-50');
            ifcDropzone.classList.remove('border-gray-300', 'hover:border-blue-500');
            updateProcessButtonState();
            
            // Show initial status for Autodesk upload
            showStatus(ifcUploadStatus, 'Ready to process IFC file');
        }
    });
    
    // XER file upload handling
    xerUploadBtn.addEventListener('click', function() {
        xerFileInput.click();
    });
    
    xerFileInput.addEventListener('change', function(e) {
        if (e.target.files.length > 0) {
            xerFile = e.target.files[0];
            xerFileName.textContent = xerFile.name;
            xerDropzone.classList.add('border-green-500', 'bg-green-50');
            xerDropzone.classList.remove('border-gray-300', 'hover:border-blue-500');
            updateProcessButtonState();
        }
    });
    
    // Drag and drop functionality for IFC
    ifcDropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        ifcDropzone.classList.add('border-blue-500', 'bg-blue-50');
    });
    
    ifcDropzone.addEventListener('dragleave', function() {
        if (!ifcFile) {
            ifcDropzone.classList.remove('border-blue-500', 'bg-blue-50');
        }
    });
    
    ifcDropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            ifcFile = e.dataTransfer.files[0];
            ifcFileName.textContent = ifcFile.name;
            ifcDropzone.classList.add('border-green-500', 'bg-green-50');
            ifcDropzone.classList.remove('border-blue-500', 'border-gray-300', 'hover:border-blue-500');
            updateProcessButtonState();
            
            // Show initial status for Autodesk upload
            showStatus(ifcUploadStatus, 'Ready to process IFC file');
        }
    });
    
    // Drag and drop functionality for XER
    xerDropzone.addEventListener('dragover', function(e) {
        e.preventDefault();
        xerDropzone.classList.add('border-blue-500', 'bg-blue-50');
    });
    
    xerDropzone.addEventListener('dragleave', function() {
        if (!xerFile) {
            xerDropzone.classList.remove('border-blue-500', 'bg-blue-50');
        }
    });
    
    xerDropzone.addEventListener('drop', function(e) {
        e.preventDefault();
        if (e.dataTransfer.files.length > 0) {
            xerFile = e.dataTransfer.files[0];
            xerFileName.textContent = xerFile.name;
            xerDropzone.classList.add('border-green-500', 'bg-green-50');
            xerDropzone.classList.remove('border-blue-500', 'border-gray-300', 'hover:border-blue-500');
            updateProcessButtonState();
        }
    });
    
    // Process files button click handler
    processFilesBtn.addEventListener('click', function() {
        if (ifcFile && xerFile) {
            // Show loading state
            processFilesBtn.innerHTML = '<span class="spinner"></span> Processing...';
            processFilesBtn.disabled = true;
            
            // Create FormData and append files
            const formData = new FormData();
            formData.append('ifcFile', ifcFile);
            formData.append('xerFile', xerFile);
            
            // Show status updates
            showStatus(ifcUploadStatus, 'Uploading IFC file to Autodesk...');
            showStatus(translationStatus, 'Preparing for processing...');
            updateTranslationProgress(10);
            
            // Simulate file upload and processing with progress updates
            setTimeout(function() {
                showStatus(ifcUploadStatus, 'IFC file uploaded successfully!');
                showStatus(translationStatus, 'Beginning model translation...');
                updateTranslationProgress(30);
                
                setTimeout(function() {
                    showStatus(translationStatus, 'Translating IFC model...');
                    updateTranslationProgress(60);
                    
                    setTimeout(function() {
                        showStatus(translationStatus, 'Translation completed successfully!');
                        updateTranslationProgress(100);
                        showSuccess('Files processed successfully!');
                        
                        // For demonstration purposes, we'll redirect to dashboard
                        setTimeout(function() {
                            window.location.href = 'dashboard.html';
                        }, 1500);
                    }, 1000);
                }, 1000);
            }, 1000);
            
            // In a real application, you would send files to server:
            /*
            fetch('/api/process-files', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    window.location.href = 'dashboard.html?projectId=' + data.projectId;
                } else {
                    // Handle error
                    showError('Error processing files: ' + data.message);
                    processFilesBtn.innerHTML = 'Process Files';
                    processFilesBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showError('An error occurred. Please try again.');
                processFilesBtn.innerHTML = 'Process Files';
                processFilesBtn.disabled = false;
            });
            */
        }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Initialize any tooltips
    const tooltips = document.querySelectorAll('.tooltip');
    tooltips.forEach(tooltip => {
        // Initialize tooltips if needed
    });
});

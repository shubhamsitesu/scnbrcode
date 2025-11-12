// Custom JavaScript extracted from barcc14.html
document.addEventListener('DOMContentLoaded', () => {
    // Element References
    const startCameraBtn = document.getElementById('start-camera-btn');
    const scanVideo = document.getElementById('scan-video');
    const chooseInterface = document.getElementById('choose-interface');
    const permissionError = document.getElementById('permission-error');
    
    const scanningView = document.getElementById('scanning-view');
    const resultContainer = document.getElementById('result-container');
    const scanOutput = document.getElementById('scan-output');
    const scanLinks = document.getElementById('scan-links');

    // Controls
    const torchBtn = document.getElementById('torch-btn');
    const uploadImageBtn = document.getElementById('upload-image-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    const uploadError = document.getElementById('upload-error');

    let currentStream = null;
    // Use ZXing from the CDN-loaded library
    let codeReader = new ZXing.BrowserMultiFormatReader(); 
    let scanRunning = false;
    let isTorchOn = false;

    // Simple Analytics
    function trackEvent(eventName, parameters = {}) {
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, parameters);
        }
        // console.log('Event tracked:', eventName, parameters);
    }

    function vibrate() { 
        if ('vibrate' in navigator) {
            navigator.vibrate(200);
        }
    }
    
    async function requestCameraPermission() {
        stopAll(); // Stop previous streams
        
        // UI Reset
        chooseInterface.classList.add('hidden');
        resultContainer.classList.add('hidden');
        scanningView.classList.remove('hidden');
        permissionError.classList.add('hidden');
        uploadError.classList.add('hidden'); 

        try {
            const constraints = { 
                video: { 
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                } 
            };
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            scanVideo.srcObject = currentStream;
            
            scanRunning = true;
            trackEvent('camera_started', { method: 'auto' });

            const track = currentStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                torchBtn.classList.remove('hidden');
            } else {
                torchBtn.classList.add('hidden');
            }

            codeReader.decodeFromStream(currentStream, scanVideo, (result, err) => {
                if (result) {
                    codeReader.reset();
                    onScanSuccess(result.text);
                }
            });

        } catch (e) {
            console.error('Camera Access Error:', e);
            trackEvent('camera_error', { error: e.message });
            stopAll();
            chooseInterface.classList.remove('hidden');
            permissionError.classList.remove('hidden');
            scanningView.classList.add('hidden');
        }
    }

    function stopAll() { 
        codeReader.reset();
        scanRunning = false;
        
        if (currentStream) {
            const track = currentStream.getVideoTracks()[0];
            if (track && track.getCapabilities().torch && isTorchOn) {
                track.applyConstraints({ advanced: [{ torch: false }] });
            }
            
            currentStream.getTracks().forEach(t => t.stop());
            scanVideo.srcObject = null;
            currentStream = null;
        }
        
        scanningView.classList.add('hidden');
        
        torchBtn.classList.add('hidden');
        torchBtn.classList.remove('torch-active');
        isTorchOn = false;
    }

    // ==========================================================
    // ===== UPDATED FUNCTION onScanSuccess (with UPI & BPOM Fixes) =====
    // ==========================================================
    function onScanSuccess(data) {
        vibrate();
        trackEvent('scan_success', { data_length: data.length });
        stopAll(); // Stop scanning and camera
        
        scanOutput.textContent = data;
        scanLinks.innerHTML = "";
        
        // FIX 1: Smart URL check for UPI, mailto:, http, www, etc.
        const isUrl = data.startsWith("http") || data.startsWith("www") || data.includes("://");
        
        let fullUrl;
        if (data.startsWith("www.")) {
            fullUrl = `https://${data}`;
        } else {
            fullUrl = data; // Handles http, upi, mailto, etc. correctly
        }

        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(data)}`;
        const bpomUrl = `https://cekbpom.pom.go.id/?keywords=${encodeURIComponent(data)}`;

        if (isUrl) {
            // This will now work for upi:// links
            scanLinks.innerHTML += `<a href="${fullUrl}" target="_blank" class="block w-full text-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105">🔗 Buka Link</a>`;
        
        // FIX 2: Removed "data.match(/^\d+$/)" to allow letters/symbols
        } else if (data.length >= 8) { 
            // This will now show BPOM button for codes like (90)NA...
            scanLinks.innerHTML += `<a href="${googleSearchUrl}" target="_blank" class="block w-full text-center bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-700 transition-all transform hover:scale-105">🔍 Cari Produk</a>`;
            scanLinks.innerHTML += `<a href="${bpomUrl}" target="_blank" class="block w-full text-center bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 mt-2">🏥 Cek BPOM</a>`;
        
        } else {
            // Fallback for short, plain text
            scanLinks.innerHTML += `<a href="${googleSearchUrl}" target="_blank" class="block w-full text-center bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-700 transition-all transform hover:scale-105">🔍 Cari di Google</a>`;
        }
        
        scanLinks.innerHTML += `<button onclick="copyResult()" class="block w-full text-center bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 mt-2">📋 Salin Teks</button>`;
        scanLinks.innerHTML += `<button onclick="scanAgain()" class="block w-full text-center bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 mt-2">♻️ Scan Lagi</button>`;

        resultContainer.classList.remove('hidden');
        uploadError.classList.add('hidden');
    }
    // ==========================================================
    // ===== END OF UPDATED FUNCTION =====
    // ==========================================================


    // --- Torch Button Click Handler ---
    torchBtn.onclick = () => {
        if (!currentStream) return;
        
        isTorchOn = !isTorchOn; 
        const track = currentStream.getVideoTracks()[0];
        
        track.applyConstraints({
            advanced: [{ torch: isTorchOn }]
        });
        
        torchBtn.classList.toggle('torch-active', isTorchOn);
        trackEvent('torch_toggled', { state: isTorchOn });
    };

    // --- Scan from Image File ---
    uploadImageBtn.onclick = () => {
        imageUploadInput.click();
        trackEvent('upload_clicked');
    };

    imageUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        stopAll(); 
        scanningView.classList.add('hidden');
        resultContainer.classList.add('hidden');
        uploadError.classList.add('hidden'); 

        const imageUrl = URL.createObjectURL(file);
        const image = new Image();
        image.src = imageUrl;
        
        image.onload = async () => {
            try { 
                const result = await codeReader.decodeFromImageElement(image);
                if (result) {
                    onScanSuccess(result.text); // Call the updated function
                    trackEvent('image_scan_success', { file_size: file.size });
                } else {
                    uploadError.textContent = 'Could not find a barcode/QR code in this image.';
                    uploadError.classList.remove('hidden');
                    trackEvent('image_scan_failed', { reason: 'no_code_found' });
                    scanAgain(false); 
                }
            } catch (e) {
                console.error('Image Scan Error:', e);
                uploadError.textContent = 'An error occurred while processing the image.';
                uploadError.classList.remove('hidden');
                trackEvent('image_scan_error', { error: e.message });
                scanAgain(false);
            }
            URL.revokeObjectURL(imageUrl); 
            imageUploadInput.value = ''; 
        };
        
        image.onerror = () => {
            console.error('Image load error');
            uploadError.textContent = 'Could not load the image file.';
            uploadError.classList.remove('hidden');
            trackEvent('image_scan_error', { error: 'image_load_failed' });
            scanAgain(false);
        };
    });
    // =========================


    // Global functions
    window.scanAgain = function(restartCamera = true) {
        resultContainer.classList.add('hidden');
        uploadError.classList.add('hidden'); 
        if (restartCamera) {
            requestCameraPermission(); 
        } else {
            chooseInterface.classList.remove('hidden');
        }
        trackEvent('scan_again');
    };

    window.copyResult = function() {
        if (!scanOutput.textContent) return;
        
        const copyButton = Array.from(document.querySelectorAll('#scan-links button'))
                               .find(btn => btn.textContent.includes('Salin Teks')); 
    
        navigator.clipboard.writeText(scanOutput.textContent).then(() => {
            trackEvent('text_copied');
            
            if (copyButton) {
                const originalText = copyButton.innerHTML;
                copyButton.innerHTML = '✅ Copied Successfully!';
                copyButton.disabled = true;
                
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                    copyButton.disabled = false;
                }, 2000);
            }
    
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Failed to copy text.');
        });
    };
    
    startCameraBtn.onclick = () => {
        requestCameraPermission();
        trackEvent('start_camera_clicked');
    };

    // --- AUTO-START THE SCANNER ON PAGE LOAD ---
    requestCameraPermission();

    // --- Other UI Scripts (FAQ, Dark Mode, Mobile Menu) ---
    document.querySelectorAll('.faq-question').forEach(q => { 
        q.addEventListener('click', () => { 
            const a = q.nextElementSibling; 
            const i = q.querySelector('.faq-icon'); 
            a.classList.toggle('hidden'); 
            i.textContent = a.classList.contains('hidden') ? '+' : '-';
            q.setAttribute('aria-expanded', a.classList.contains('hidden') ? 'false' : 'true');
            trackEvent('faq_toggled', { question: q.querySelector('span').textContent });
        }); 
    });

    const darkModeToggle = document.getElementById('darkModeToggle');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    darkModeToggle.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
        trackEvent('dark_mode_toggled', { state: document.documentElement.classList.contains('dark') });
    });

    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
        trackEvent('mobile_menu_toggled');
    });
    
    // Page visibility API to pause/resume scanning
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (scanRunning) {
                stopAll();
            }
        } else {
            if (resultContainer.classList.contains('hidden')) {
                requestCameraPermission();
            }
        }
    });
});

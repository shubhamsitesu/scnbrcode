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
    
    // === PERUBAHAN DI SINI ===
    // Referensi ke elemen error yang baru
    const uploadError = document.getElementById('upload-error');
    // =========================

    let currentStream = null;
    let codeReader = new ZXing.BrowserMultiFormatReader();
    let scanRunning = false;
    let isTorchOn = false;

    // Performance monitoring
    const performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
            if (entry.entryType === 'measure') {
                console.log(`${entry.name}: ${entry.duration}ms`);
            }
        }
    });
    performanceObserver.observe({ entryTypes: ['measure'] });

    // Analytics and Performance Tracking
    function trackEvent(eventName, parameters = {}) {
        // Google Analytics 4 event tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, parameters);
        }
        
        // Custom analytics
        console.log('Event tracked:', eventName, parameters);
        
        // Performance mark
        performance.mark(`${eventName}_start`);
    }

    function vibrate() { 
        if ('vibrate' in navigator) {
            navigator.vibrate(200);
        }
    }
    
    async function requestCameraPermission() {
        performance.mark('camera_request_start');
        stopAll(); // Stop previous streams
        
        // UI Reset
        chooseInterface.classList.add('hidden');
        resultContainer.classList.add('hidden');
        scanningView.classList.remove('hidden');
        permissionError.classList.add('hidden');
        uploadError.classList.add('hidden'); // Sembunyikan error upload juga

        try {
            // Use "environment" (back camera) only
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
            performance.mark('camera_started');

            // --- Torch Capability Check ---
            const track = currentStream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                // Show button only if device supports torch
                torchBtn.classList.remove('hidden');
            } else {
                torchBtn.classList.add('hidden');
            }
            // --- End Torch Check ---

            // Fix for "video already playing" by letting the library handle playback
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
        
        performance.measure('camera_request_time', 'camera_request_start', 'camera_started');
    }

    function stopAll() { 
        codeReader.reset();
        scanRunning = false;
        
        if (currentStream) {
            // Turn off torch before stopping stream
            const track = currentStream.getVideoTracks()[0];
            if (track && track.getCapabilities().torch && isTorchOn) {
                track.applyConstraints({ advanced: [{ torch: false }] });
            }
            
            currentStream.getTracks().forEach(t => t.stop());
            scanVideo.srcObject = null;
            currentStream = null;
        }
        
        scanningView.classList.add('hidden');
        resultContainer.classList.add('hidden');
        
        // Reset torch state and button
        torchBtn.classList.add('hidden');
        torchBtn.classList.remove('torch-active');
        isTorchOn = false;
    }

    function onScanSuccess(data) {
        performance.mark('scan_success_start');
        vibrate();
        trackEvent('scan_success', { data_length: data.length });
        stopAll(); // Stop scanning and camera
        
        scanOutput.textContent = data;
        scanLinks.innerHTML = "";
        
        const isUrl = data.startsWith("http") || data.startsWith("www");
        const fullUrl = data.startsWith("http") ? data : `https://`;
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(data)}`;
        const bpomUrl = `https://cekbpom.pom.go.id/${encodeURIComponent(data)}`;

        if (isUrl) {
            scanLinks.innerHTML += `<a href="${fullUrl}" target="_blank" class="block w-full text-center bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-all transform hover:scale-105">🔗 Buka Link</a>`;
        } else if (data.length >= 8 && data.match(/^\d+$/)) {
            scanLinks.innerHTML += `<a href="${googleSearchUrl}" target="_blank" class="block w-full text-center bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-700 transition-all transform hover:scale-105">🔍 Cari Produk</a>`;
            scanLinks.innerHTML += `<a href="${bpomUrl}" target="_blank" class="block w-full text-center bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 mt-2">🏥 Cek BPOM</a>`;
        } else {
            scanLinks.innerHTML += `<a href="${googleSearchUrl}" target="_blank" class="block w-full text-center bg-yellow-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-yellow-700 transition-all transform hover:scale-105">🔍 Cari di Google</a>`;
        }
        
        scanLinks.innerHTML += `<button onclick="copyResult()" class="block w-full text-center bg-gray-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-gray-700 transition-all transform hover:scale-105 mt-2">📋 Salin Teks</button>`;
        scanLinks.innerHTML += `<button onclick="scanAgain()" class="block w-full text-center bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-all transform hover:scale-105 mt-2">♻️ Scan Lagi</button>`;

        resultContainer.classList.remove('hidden');
        performance.mark('scan_success_end');
        performance.measure('scan_processing_time', 'scan_success_start', 'scan_success_end');
    }

    // --- Torch Button Click Handler ---
    torchBtn.onclick = () => {
        if (!currentStream) return;
        
        isTorchOn = !isTorchOn; // Toggle state
        const track = currentStream.getVideoTracks()[0];
        
        // Apply constraints to toggle torch
        track.applyConstraints({
            advanced: [{ torch: isTorchOn }]
        });
        
        // Update button style
        torchBtn.classList.toggle('torch-active', isTorchOn);
        trackEvent('torch_toggled', { state: isTorchOn });
    };

    // === PERUBAHAN DI SINI ===
    // --- Scan from Image File (dengan Error Handling yang lebih baik) ---
    uploadImageBtn.onclick = () => {
        imageUploadInput.click();
        trackEvent('upload_clicked');
    };

    imageUploadInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        stopAll(); // Stop camera
        scanningView.classList.add('hidden');
        resultContainer.classList.add('hidden');
        
        // Sembunyikan error sebelumnya
        uploadError.classList.add('hidden'); 

        const imageUrl = URL.createObjectURL(file);
        const image = new Image();
        image.src = imageUrl;
        
        image.onload = async () => {
            try { // try...catch dipindahkan ke dalam onload
                const result = await codeReader.decodeFromImageElement(image);
                if (result) {
                    onScanSuccess(result.text);
                    trackEvent('image_scan_success', { file_size: file.size });
                } else {
                    // Tampilkan error di UI, bukan alert
                    uploadError.textContent = 'Could not find a barcode/QR code in this image.';
                    uploadError.classList.remove('hidden');
                    trackEvent('image_scan_failed', { reason: 'no_code_found' });
                    scanAgain(); // Panggil scanAgain untuk kembali ke mode scan
                }
            } catch (e) {
                // Tampilkan error di UI, bukan alert
                console.error('Image Scan Error:', e);
                uploadError.textContent = 'An error occurred while processing the image.';
                uploadError.classList.remove('hidden');
                trackEvent('image_scan_error', { error: e.message });
                scanAgain(); // Panggil scanAgain untuk kembali ke mode scan
            }
            URL.revokeObjectURL(imageUrl); // Free memory
        };
        
        image.onerror = () => {
            // Handle jika file gambar rusak atau bukan gambar
            console.error('Image load error');
            uploadError.textContent = 'Could not load the image file.';
            uploadError.classList.remove('hidden');
            trackEvent('image_scan_error', { error: 'image_load_failed' });
            scanAgain();
        };
    });
    // =========================


    // === PERUBAHAN DI SINI ===
    // Global functions (dengan copyResult yang diperbarui)
    window.scanAgain = function() {
        resultContainer.classList.add('hidden');
        uploadError.classList.add('hidden'); // Sembunyikan error saat scan lagi
        requestCameraPermission(); // Restart full camera process
        trackEvent('scan_again');
    };

    window.copyResult = function() {
        if (!scanOutput.textContent) return;
        
        // Cari tombol "Salin Teks"
        const copyButton = Array.from(document.querySelectorAll('#scan-links button'))
                               .find(btn => btn.textContent.includes('Salin Teks')); // "Salin Teks" = Copy Text
    
        navigator.clipboard.writeText(scanOutput.textContent).then(() => {
            trackEvent('text_copied');
            
            // Berikan umpan balik visual
            if (copyButton) {
                const originalText = copyButton.innerHTML;
                copyButton.innerHTML = '✅ Copied Successfully!';
                copyButton.disabled = true;
                
                // Kembalikan setelah 2 detik
                setTimeout(() => {
                    copyButton.innerHTML = originalText;
                    copyButton.disabled = false;
                }, 2000);
            }
    
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            // Jika gagal, gunakan alert sebagai fallback
            alert('Failed to copy text.');
        });
    };
    // =========================
    
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
    
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered');
                trackEvent('service_worker_registered');
            })
            .catch(error => {
                console.log('SW registration failed');
                trackEvent('service_worker_error', { error: error.message });
            });
    }
    
    // Intersection Observer for lazy loading animations
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    document.querySelectorAll('.feature-card, .testimonial, .stat-card').forEach(el => {
        observer.observe(el);
    });
    
    // Page visibility API to pause/resume scanning (Sudah diperbaiki)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Jika tab disembunyikan DAN pemindai sedang berjalan,
            // hentikan total untuk melepaskan kamera.
            if (scanRunning) {
                stopAll();
            }
        } else {
            // Jika tab kembali terlihat,
            // dan pengguna TIDAK sedang melihat hasil (resultContainer tersembunyi),
            // mulai ulang proses kamera.
            if (resultContainer.classList.contains('hidden')) {
                // requestCameraPermission() akan menangani semua
                // logika untuk meminta stream baru dan menampilkan pemindai.
                requestCameraPermission();
            }
            // Jika pengguna sedang melihat hasil (resultContainer terlihat),
            // jangan lakukan apa-apa. Biarkan mereka melihat hasilnya.
        }
    });

    
    // Network status detection
    window.addEventListener('online', () => {
        trackEvent('network_status_changed', { status: 'online' });
    });
    
    window.addEventListener('offline', () => {
        trackEvent('network_status_changed', { status: 'offline' });
    });
    
    // Core Web Vitals monitoring
    try {
        import('https://unpkg.com/web-vitals?module').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
            getCLS(console.log);
            getFID(console.log);
            getFCP(console.log);
            getLCP(console.log);
            getTTFB(console.log);
        });
    } catch(e) {
        console.error('Web Vitals loading failed', e);
    }
});

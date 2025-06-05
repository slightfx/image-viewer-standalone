class ImageViewerStandalone {
    constructor(container, config = {}) {
        // Container element where the viewer will be displayed
        this.container = typeof container === 'string' 
            ? document.querySelector(container) 
            : container;
            
        if (!this.container) {
            throw new Error("Container element not found2");
        }
        
        // Initialize properties
        this.currentGroupIndex = 0;
        this.currentImageIndex = 0;
        this.currentBoxIndex = 0;
        this.currentGroup = null;
        this.onCompleteCallbacks = [];
        this.showBoxes = config.debug || false;
        this.isDarkMode = config.darkMode || false;
        
        // Add isLocalhost check
        this.isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // Tracking metrics
        this.startTime = 0;
        this.clickCount = 0;
        this.totalSteps = 0;
        this.completed = false;
        this.exitStep = 0;
        this.demoStarted = false;
        
        // Track visited positions for navigation
        this.visitedPositions = new Set();
        this.maxVisitedImageIndex = 0;
        this.maxVisitedBoxIndex = 0;
        
        // User data
        this.userData = {
            userId: config.userId || 0,
            userEmail: config.userEmail || '',
            articleId: config.articleId || 0,
            articleTitle: config.articleTitle || '',
            articleVersion: config.articleVersion || '',
            exerciseId: config.exerciseId || '',
            exerciseTitle: config.exerciseTitle || ''
        };
        
        // Setup the viewer
        this.setupStyles();
        this.setupContainer();
        this.setupKeyboardListener();
    }

    setupKeyboardListener() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'l') {
                this.showBoxes = !this.showBoxes;
                if (this.currentGroup) {
                    this.showGroup(this.currentGroup);
                }
            }
            
            // Handle arrow key navigation
            if (this.demoStarted && this.currentGroup && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                this.handleArrowNavigation(e.key);
            }
        });
    }

    handleArrowNavigation(key) {
        if (!this.currentGroup || !this.currentGroup.images) return;
        
        if (key === 'ArrowRight') {
            this.navigateNext();
        } else if (key === 'ArrowLeft') {
            this.navigatePrevious();
        }
    }

    navigateNext() {
        const imgData = this.currentGroup.images[this.currentImageIndex];
        let nextImageIndex = this.currentImageIndex;
        let nextBoxIndex = this.currentBoxIndex;
        
        // Calculate next position
        if (this.currentBoxIndex < imgData.boxes.length - 1) {
            nextBoxIndex = this.currentBoxIndex + 1;
        } else if (this.currentImageIndex < this.currentGroup.images.length - 1) {
            nextImageIndex = this.currentImageIndex + 1;
            nextBoxIndex = 0;
        } else {
            // At the end, can't go further
            return;
        }
        
        // Check if navigation is allowed
        if (this.canNavigateToPosition(nextImageIndex, nextBoxIndex)) {
            this.currentImageIndex = nextImageIndex;
            this.currentBoxIndex = nextBoxIndex;
            this.showGroup(this.currentGroup);
        }
    }

    navigatePrevious() {
        let prevImageIndex = this.currentImageIndex;
        let prevBoxIndex = this.currentBoxIndex;
        
        // Calculate previous position
        if (this.currentBoxIndex > 0) {
            prevBoxIndex = this.currentBoxIndex - 1;
        } else if (this.currentImageIndex > 0) {
            prevImageIndex = this.currentImageIndex - 1;
            const prevImgData = this.currentGroup.images[prevImageIndex];
            prevBoxIndex = prevImgData.boxes.length - 1;
        } else {
            // At the beginning, can't go back further
            return;
        }
        
        // Check if navigation is allowed
        if (this.canNavigateToPosition(prevImageIndex, prevBoxIndex)) {
            this.currentImageIndex = prevImageIndex;
            this.currentBoxIndex = prevBoxIndex;
            this.showGroup(this.currentGroup);
        }
    }

    canNavigateToPosition(imageIndex, boxIndex) {
        // If demo is completed, allow navigation anywhere
        if (this.completed) {
            return true;
        }
        
        // If demo is not completed, only allow navigation to visited positions
        const positionKey = `${imageIndex}-${boxIndex}`;
        return this.visitedPositions.has(positionKey);
    }

    markCurrentPositionAsVisited() {
        const positionKey = `${this.currentImageIndex}-${this.currentBoxIndex}`;
        this.visitedPositions.add(positionKey);
        
        // Update max visited indices for easier tracking
        if (this.currentImageIndex > this.maxVisitedImageIndex || 
            (this.currentImageIndex === this.maxVisitedImageIndex && this.currentBoxIndex > this.maxVisitedBoxIndex)) {
            this.maxVisitedImageIndex = this.currentImageIndex;
            this.maxVisitedBoxIndex = this.currentBoxIndex;
        }
    }

    setupStyles() {
        // Remove existing styles if present
        const existingStyle = document.getElementById('image-viewer-standalone-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const styles = `
            .image-viewer-standalone {
                /* Use CSS variables for easier theme management */
                --viewer-bg: ${this.isDarkMode ? '#1E1E1E' : '#F8F8F8'};
                --viewer-text: ${this.isDarkMode ? '#E0E0E0' : '#111111'};
                --viewer-button-bg: ${this.isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'};
                --viewer-button-hover: ${this.isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'};
                --viewer-description-bg: ${this.isDarkMode ? 'rgba(40, 40, 40, 0.9)' : 'rgba(222, 222, 222, 0.9)'};
                --viewer-box-border: #0D99FF; /* Figma blue */
                --viewer-box-bg: rgba(13, 153, 255, 0.15); /* Light blue fill */
                --viewer-box-hover-border: #0B7ACC; /* Darker blue on hover */
                --viewer-box-hover-bg: rgba(13, 153, 255, 0.25);
                --viewer-intro-button-bg: #0D99FF;
                --viewer-intro-button-hover-bg: #0B7ACC;

                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: "Clarika Geometric", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica Neue, Helvetica, Arial, sans-serif;
                color: var(--viewer-text);
                user-select: none;
                -webkit-user-select: none;
                background: var(--viewer-bg);
                overflow: hidden;
                width: 1200px;
                height: 100%;
                min-height: 400px;
                position: relative;
                margin: 0 auto;
            }

            .viewer-content {
                position: relative;
                width: 1200px;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 0px;
                box-sizing: border-box;
            }

            .viewer-image-container {
                position: relative;
                margin-bottom: 10px;
                width: 1200px;
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center; /* Changed from flex-start to center for vertical centering */
                align-items: center;
                overflow: hidden;
            }

            .viewer-image-wrapper {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                position: relative;
                width: 1200px;
                max-width: 1200px;
                border-radius: 8px;
                border: 0px solid #ddd;
                box-sizing: border-box;
                background: #fff;
                padding-bottom: 10px;
            }
            
            .viewer-image-container img {
                max-width: 1200px;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
                
            }

            .viewer-image-container .viewer-description {
                width: 100%;
                box-sizing: border-box;
                padding: 0 10px;
                text-align: center;
                margin: 10px 0 0 0;
                pointer-events: auto;
            }
            
            .viewer-image-wrapper .viewer-description {
                width: 100%;
                box-sizing: border-box;
                padding: 0 10px;
                text-align: center;
                margin: 10px 0 0 0;
                pointer-events: auto;
                z-index: 2; /* Ensure description is above the box overlay */
            }
            
            .box-overlay {
                position: absolute;
                top: 0;
                pointer-events: none;
                display: flex;
                flex-direction: column;
                align-items: center;
            }

            .box-overlay .viewer-description {
                pointer-events: auto;
                width: 100%;
                margin-top: 10px;
            }

            .viewer-box {
                position: relative;
                border: 2px solid transparent;
                background: transparent;
                pointer-events: auto;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
                opacity: 0;
            }

            .viewer-box.show-box-debug {
                opacity: 1;
                border: 2px solid var(--viewer-box-border);
                background: var(--viewer-box-bg);
            }

            .viewer-box.show-box-debug:hover {
                border-color: var(--viewer-box-hover-border);
                background: var(--viewer-box-hover-bg);
            }

            .viewer-box-title {
                position: absolute;
                bottom: 100%;
                left: 0;
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 2px 5px;
                border-radius: 3px;
                font-size: 10px;
                white-space: nowrap;
                margin-bottom: 3px;
                opacity: 0;
                transition: opacity 0.2s ease;
            }

            .viewer-box:hover .viewer-box-title {
                opacity: 1;
            }

            .viewer-box.show-box-debug {
                border: 2px solid #00ff00 !important;
                background: rgba(0, 255, 0, 0.1) !important;
            }
            .viewer-box.show-box-debug .viewer-box-title {
                background: rgba(0, 100, 0, 0.7);
            }

            /* Controls removed as they are no longer needed */

            .viewer-description {
                margin-top: 10px;
                padding: 2px 20px;
                background: #f7f7f7;
                color:rgb(0, 0, 0);
                border-radius: 4px;
                text-align: center;
                font-size: 16px;
                line-height: 1.4;
                max-height: 5em;
                overflow-y: auto;
                box-sizing: border-box;
                margin-bottom: 10px; !important;
            }
            
            /* Description outside of box-overlay */
            .viewer-content > .viewer-description {
                max-width: 90%;
            }

            /* Markdown content styles */
            .viewer-description h1,
            .viewer-description h2,
            .viewer-description h3,
            .viewer-description h4,
            .viewer-description h5,
            .viewer-description h6 {
                margin: 0.5em 0;
                color: var(--viewer-text);
                font-weight: 600;
            }

            .viewer-description h1 { font-size: 1.2em; }
            .viewer-description h2 { font-size: 1.1em; }
            .viewer-description h3 { font-size: 1.05em; }
            .viewer-description h4,
            .viewer-description h5,
            .viewer-description h6 { font-size: 1em; }

            .viewer-description p {
                margin: 0.5em 0;
                line-height: 1.4;
            }

            .viewer-description ul,
            .viewer-description ol {
                margin: 0.5em 0;
                padding-left: 1.5em;
                text-align: left;
            }

            .viewer-description li {
                margin: 0.25em 0;
            }

            .viewer-description strong {
                font-weight: 600;
            }

            .viewer-description em {
                font-style: italic;
            }

            .viewer-description code {
                background: rgba(0, 0, 0, 0.1);
                padding: 0.1em 0.3em;
                border-radius: 3px;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.9em;
            }

            .viewer-description blockquote {
                border-left: 3px solid var(--viewer-intro-button-bg);
                margin: 0.5em 0;
                padding-left: 1em;
                color: var(--viewer-text);
                opacity: 0.8;
            }

            .viewer-description a {
                color: var(--viewer-intro-button-bg);
                text-decoration: none;
            }

            .viewer-description a:hover {
                text-decoration: underline;
            }

            .intro-page, .end-page {
                text-align: center;
                padding: 40px;
                width: 1200px;
                max-width: 1200px;
                box-sizing: border-box;
            }
            
            .end-page {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                height: 100%;
                min-height: 400px;
            }

            .intro-page h2, .end-page h2 {
                margin-bottom: 16px;
                font-size: 22px;
                font-weight: 700;
            }

            .intro-page p {
                margin-bottom: 24px;
                line-height: 1.6;
                font-size: 16px;
                color: ${this.isDarkMode ? '#B0B0B0' : '#555555'};
            }

            .viewer-button {
                background: var(--viewer-intro-button-bg);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 15px;
                font-weight: 500;
                margin-top: 20px;
                transition: background-color 0.2s ease;
            }

            .viewer-button:hover {
                background: var(--viewer-intro-button-hover-bg);
            }
            
            .email-validation {
                text-align: center;
                padding: 40px;
                width: 1200px;
                max-width: 1200px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-sizing: border-box;
                height: 100%;
                min-height: 400px;
            }

            .email-validation h2 {
                margin-bottom: 16px;
                font-size: 22px;
                font-weight: 700;
            }

            .email-validation p {
                margin-bottom: 24px;
                line-height: 1.6;
                color: var(--viewer-text);
            }
            
            .email-validation > div {
                width: 100%;
                margin-bottom: 20px;
            }

            .instruction-panel {
                /* Instruction panel styles kept for potential future use */
                background: ${this.isDarkMode ? 'rgba(70, 70, 70, 0.5)' : 'rgba(240, 240, 240, 0.8)'};
                border: 1px solid ${this.isDarkMode ? '#555' : '#ddd'};
                border-radius: 8px;
                overflow: hidden;
                margin-bottom: 20px;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
            }

            .instruction-header {
                background: ${this.isDarkMode ? '#555' : '#eee'};
                padding: 8px 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 500;
                color: ${this.isDarkMode ? '#fff' : '#333'};
                border-bottom: 1px solid ${this.isDarkMode ? '#666' : '#ddd'};
            }

            .instruction-content {
                padding: 12px;
                text-align: left;
            }

            .instruction-content p {
                margin: 0 0 8px 0;
                line-height: 1.4;
            }

            .instruction-content p:last-child {
                margin-bottom: 0;
            }

            .pagination-container {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px 0;
                margin-top: 10px;
                gap: 8px;
                flex-wrap: wrap;
            }

            .pagination-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 2px solid transparent;
                position: relative;
            }

            .pagination-dot.not-completed {
                background: #ccc;
            }

            .pagination-dot.completed {
                background: #28a745;
            }

            .pagination-dot.current {
                background: #0D99FF;
                border: 2px solid #0B7ACC;
                transform: scale(1.2);
            }

            .pagination-dot.clickable:hover {
                transform: scale(1.3);
                opacity: 0.8;
            }

            .pagination-dot.not-clickable {
                cursor: not-allowed;
                opacity: 0.5;
            }

            .pagination-info {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-left: 15px;
                font-size: 14px;
                color: var(--viewer-text);
            }

            .pagination-progress {
                font-weight: 600;
            }

            .pagination-remaining {
                color: var(--viewer-text);
                opacity: 0.7;
            }
        `;
        
        const styleElement = document.createElement('style');
        styleElement.id = 'image-viewer-standalone-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    setupContainer() {
        // Clear the container
        this.container.innerHTML = '';
        
        // Add viewer wrapper
        this.viewerWrapper = document.createElement('div');
        this.viewerWrapper.className = 'image-viewer-standalone';
        
        // Add content container
        this.contentContainer = document.createElement('div');
        this.contentContainer.className = 'viewer-content';
        
        // Track all clicks within the viewer content
        this.contentContainer.addEventListener('click', () => {
            this.clickCount++;
        });
        
        this.viewerWrapper.appendChild(this.contentContainer);
        this.container.appendChild(this.viewerWrapper);
    }

    load(config) {
        console.log(config)
        if (!config || !config.groups || config.groups.length === 0) {
            console.error('Invalid configuration: No groups found');
            return;
        }
        
        // Initialize tracking metrics
        this.startTime = Date.now();
        this.clickCount = 0;
        this.completed = false;
        this.exitStep = 0;
        
        const group = config.groups[0];
        this.currentGroup = group;
        
        // Calculate total steps
        this.totalSteps = group.images.reduce((total, img) => {
            return total + (img.boxes ? img.boxes.length : 0);
        }, 0);

        // Update exerciseTitle with the group title if available
        if (group.title && this.userData) {
            this.userData.exerciseTitle = group.title;
        }

        // Always show the email validation page first
        this.showEmailValidation();
    }

    showEmailValidation() {
        this.contentContainer.innerHTML = '';
        const emailForm = document.createElement('div');
        emailForm.className = 'email-validation';

        // Email section
        const emailSection = document.createElement('div');
        emailSection.style.marginBottom = '24px';

        const emailTitle = document.createElement('h2');
        emailTitle.textContent = this.currentGroup.title || 'Interactive Demo';
        emailSection.appendChild(emailTitle);

        if (this.currentGroup.description) {
            const introDescription = document.createElement('div');
            // Use marked.js to render markdown if available, otherwise fallback to plain text
            if (typeof marked !== 'undefined') {
                introDescription.innerHTML = marked.parse(this.currentGroup.description);
            } else {
                introDescription.textContent = this.currentGroup.description;
            }
            introDescription.style.marginBottom = '32px';
            introDescription.style.textAlign = 'center';
            introDescription.style.fontSize = '16px';
            introDescription.style.marginTop = '42px';
            emailSection.appendChild(introDescription);
        }

        emailForm.appendChild(emailSection);

        // Start demo button
        const startButton = document.createElement('button');
        startButton.textContent = 'Continue';
        startButton.className = 'viewer-button';

        startButton.onclick = () => {
            this.showGroup(this.currentGroup);
        };

        emailForm.appendChild(startButton);
        this.contentContainer.appendChild(emailForm);
    }

    showGroup(group) {
        this.contentContainer.innerHTML = ''; // Clear previous content
        this.demoStarted = true; // Set flag when demo content is shown

        // Mark current position as visited
        this.markCurrentPositionAsVisited();

        if (!group || !group.images || group.images.length === 0) {
            this.contentContainer.textContent = 'Error: Invalid group data or no images found.';
            return;
        }

        if (this.currentImageIndex >= group.images.length) {
             console.warn('currentImageIndex out of bounds, resetting.');
             this.currentImageIndex = 0;
        }

        const imgData = group.images[this.currentImageIndex];

        if (!imgData || !imgData.base64) {
            this.contentContainer.textContent = `Error: Invalid image data for image index ${this.currentImageIndex}.`;
            return;
        }

        // Show image title if available
        if (imgData.title) {
            const imageTitle = document.createElement('div');
            imageTitle.className = 'viewer-description';
            // Use marked.js to render markdown if available, otherwise fallback to plain text
            if (typeof marked !== 'undefined') {
                imageTitle.innerHTML = marked.parse(imgData.title);
            } else {
                imageTitle.textContent = imgData.title;
            }
            imageTitle.style.marginBottom = '15px';
            this.contentContainer.appendChild(imageTitle);
        }

        const imageContainer = document.createElement('div');
        imageContainer.className = 'viewer-image-container';

        // Create a wrapper for the image and box overlay
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'viewer-image-wrapper';

        const imageElement = document.createElement('img');
        imageElement.src = imgData.base64;

        const boxOverlay = document.createElement('div');
        boxOverlay.className = 'box-overlay';

        this.setupImageAndBoxes(imgData, imageElement, imageWrapper, boxOverlay, group);

        imageElement.onerror = () => {
             this.contentContainer.textContent = `Error: Failed to load image at index ${this.currentImageIndex}.`;
        };

        imageWrapper.appendChild(imageElement);
        
        // If there's a description for the current box, add it directly inside the image wrapper (under the image)
        if (imgData.boxes && imgData.boxes.length > 0 && this.currentBoxIndex < imgData.boxes.length) {
            const boxData = imgData.boxes[this.currentBoxIndex];
            if (boxData.description) {
                const descriptionElement = document.createElement('div');
                descriptionElement.className = 'viewer-description';
                
                // Use marked.js to render markdown if available, otherwise fallback to plain text
                if (typeof marked !== 'undefined') {
                    descriptionElement.innerHTML = marked.parse(boxData.description);
                } else {
                    descriptionElement.textContent = boxData.description;
                }
                
                // Add description inside the image wrapper, after the image element
                imageWrapper.appendChild(descriptionElement);
            }
        }
        
        imageWrapper.appendChild(boxOverlay);
        imageContainer.appendChild(imageWrapper);
        
        this.contentContainer.appendChild(imageContainer);
        
        // Add pagination
        this.createPagination();
    }

    createPagination() {
        if (!this.currentGroup || !this.currentGroup.images) return;
        
        const paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        
        // Create dots for each step (image + box combination)
        let stepIndex = 0;
        this.currentGroup.images.forEach((imgData, imageIndex) => {
            if (imgData.boxes && imgData.boxes.length > 0) {
                imgData.boxes.forEach((boxData, boxIndex) => {
                    const dot = document.createElement('div');
                    dot.className = 'pagination-dot';
                    
                    // Determine dot state
                    const isCurrentPosition = imageIndex === this.currentImageIndex && boxIndex === this.currentBoxIndex;
                    const isCompleted = this.isImageCompleted(imageIndex, boxIndex);
                    const canNavigate = this.canNavigateToImage(imageIndex, boxIndex);
                    
                    if (isCurrentPosition) {
                        dot.classList.add('current');
                    } else if (isCompleted) {
                        dot.classList.add('completed');
                    } else {
                        dot.classList.add('not-completed');
                    }
                    
                    if (canNavigate) {
                        dot.classList.add('clickable');
                        dot.onclick = () => this.navigateToImage(imageIndex, boxIndex);
                    } else {
                        dot.classList.add('not-clickable');
                    }
                    
                    paginationContainer.appendChild(dot);
                    stepIndex++;
                });
            }
        });
        
        // Add progress info
        const progressInfo = document.createElement('div');
        progressInfo.className = 'pagination-info';
        
        const currentStep = this.getCurrentStepNumber();
        const totalSteps = this.totalSteps;
        const completedSteps = this.getCompletedImageCount();
        
        const progressText = document.createElement('span');
        progressText.className = 'pagination-progress';
        progressText.textContent = `Step ${currentStep} of ${totalSteps}`;
        progressInfo.appendChild(progressText);
        
        const remainingText = document.createElement('span');
        remainingText.className = 'pagination-remaining';
        remainingText.textContent = `(${completedSteps} completed)`;
        progressInfo.appendChild(remainingText);
        
        paginationContainer.appendChild(progressInfo);
        this.contentContainer.appendChild(paginationContainer);
    }

    isImageCompleted(imageIndex, boxIndex) {
        // Check if this position has been visited
        const positionKey = `${imageIndex}-${boxIndex}`;
        return this.visitedPositions.has(positionKey);
    }

    getCompletedImageCount() {
        // Count how many positions have been visited
        return this.visitedPositions.size;
    }

    canNavigateToImage(imageIndex, boxIndex) {
        // If demo is completed, allow navigation anywhere
        if (this.completed) {
            return true;
        }
        
        // If demo is not completed, only allow navigation to visited positions
        const positionKey = `${imageIndex}-${boxIndex}`;
        return this.visitedPositions.has(positionKey);
    }

    navigateToImage(imageIndex, boxIndex) {
        if (this.canNavigateToImage(imageIndex, boxIndex)) {
            this.currentImageIndex = imageIndex;
            this.currentBoxIndex = boxIndex;
            this.showGroup(this.currentGroup);
        }
    }

    getCurrentStepNumber() {
        // Calculate current step number based on current position
        let stepNumber = 1;
        for (let i = 0; i < this.currentImageIndex; i++) {
            const imgData = this.currentGroup.images[i];
            if (imgData.boxes) {
                stepNumber += imgData.boxes.length;
            }
        }
        stepNumber += this.currentBoxIndex + 1;
        return stepNumber;
    }

    setupImageAndBoxes(imgData, imageElement, imageWrapper, boxOverlay, group) {
        // Store original box data for recalculation
        this.originalBoxData = imgData.boxes ? [...imgData.boxes] : [];
        
        imageElement.onload = () => {
            const naturalWidth = imageElement.naturalWidth;
            const naturalHeight = imageElement.naturalHeight;
            
            // Fixed width for the wrapper to maintain consistent sizing
            imageWrapper.style.width = '1200px';
            
            // One-time box position calculation (no dynamic resizing)
            const setupBoxPositions = () => {
                // Fixed container width
                const containerWidth = 1200;
                
                // Calculate fixed scale based on natural image dimensions and our fixed width
                const scaleX = containerWidth / naturalWidth;
                const scale = Math.min(1, scaleX);
                
                // Calculate scaled image dimensions
                const scaledWidth = naturalWidth * scale;
                const scaledHeight = naturalHeight * scale;
                
                // Update box overlay size
                boxOverlay.style.width = scaledWidth + 'px';
                boxOverlay.style.height = 'auto';
                boxOverlay.style.minHeight = scaledHeight + 'px';
                
                // Center the overlay horizontally
                const leftOffset = (containerWidth - scaledWidth) / 2;
                boxOverlay.style.left = leftOffset + 'px';
                boxOverlay.style.transform = 'none';
                
                // Clear existing boxes
                boxOverlay.innerHTML = '';
                
                // Create boxes with fixed scaling
                if (this.originalBoxData && this.currentBoxIndex < this.originalBoxData.length) {
                    const boxData = this.originalBoxData[this.currentBoxIndex];
                    
                    const boxElement = document.createElement('div');
                    boxElement.className = 'viewer-box';
                    if (this.showBoxes) {
                        boxElement.classList.add('show-box-debug');
                    }
                    
                    // Calculate fixed box position and size
                    const boxRelX = ((boxData.x - imgData.x) / (imgData.scale || 1)) * scale;
                    const boxRelY = ((boxData.y - imgData.y) / (imgData.scale || 1)) * scale;
                    const boxRelWidth = (boxData.width / (imgData.scale || 1)) * scale;
                    const boxRelHeight = (boxData.height / (imgData.scale || 1)) * scale;
                    
                    // Create a container div for positioning the box
                    const boxPositioner = document.createElement('div');
                    boxPositioner.style.position = 'absolute';
                    boxPositioner.style.left = boxRelX + 'px';
                    boxPositioner.style.top = boxRelY + 'px';
                    
                    // Set box dimensions
                    boxElement.style.width = boxRelWidth + 'px';
                    boxElement.style.height = boxRelHeight + 'px';
                    
                    // Append the boxElement to the positioner
                    boxPositioner.appendChild(boxElement);
                    
                    // Add title tooltip inside the box if showBoxes is true
                    if (this.showBoxes && boxData.title) {
                        const titleElement = document.createElement('div');
                        titleElement.className = 'viewer-box-title';
                        titleElement.textContent = boxData.title;
                        boxElement.appendChild(titleElement);
                    }
                    
                    boxElement.onclick = () => {
                        this.advanceStep(group);
                    };
                    
                    // Add box positioner to overlay
                    boxOverlay.appendChild(boxPositioner);
                }
            };
            
            // Initial positioning - this is now the only time we position the boxes
            setupBoxPositions();
            
            // Remove resize observer to prevent dynamic resizing
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
                this.resizeObserver = null;
            }
            
            // Remove window resize event listener
            window.removeEventListener('resize', this.updateBoxPositions);
        };
    }

    advanceStep(group) {
        const imgData = group.images[this.currentImageIndex];
        if (this.currentBoxIndex < imgData.boxes.length - 1) {
            this.currentBoxIndex++;
            this.showGroup(group);
        } else if (this.currentImageIndex < group.images.length - 1) {
            this.currentImageIndex++;
            this.currentBoxIndex = 0;
            this.showGroup(group);
        } else {
            this.completed = true;
            this.exitStep = this.totalSteps;
            this.showEndPage();
        }
    }
    showEndPage() {

        if (this.onCompleteCallbacks.length > 0) {
            this.onCompleteCallbacks.forEach(callback => callback());
        }
        this.contentContainer.innerHTML = '';
        
        // Set flex container properties on contentContainer to ensure full centering
        this.contentContainer.style.display = 'flex';
        this.contentContainer.style.flexDirection = 'column';
        this.contentContainer.style.justifyContent = 'center';
        this.contentContainer.style.alignItems = 'center';
        this.contentContainer.style.height = '100%';
        
        const endPage = document.createElement('div');
        endPage.className = 'end-page';
        
        const endTitle = document.createElement('h2');
        endTitle.textContent = 'Congratulations! 🎉';
        endTitle.style.cssText = 'color: var(--viewer-intro-button-bg); margin-bottom: 10px;';
        endPage.appendChild(endTitle);
        
        const endSubtitle = document.createElement('p');
        endSubtitle.textContent = 'You have successfully completed the interactive demo';
        endSubtitle.style.cssText = 'font-size: 16px; margin-top: 0; margin-bottom: 20px;';
        endPage.appendChild(endSubtitle);
        
        // Calculate statistics
        const durationMs = Date.now() - this.startTime;
        const durationSeconds = Math.round(durationMs / 1000);
        const minutes = Math.floor(durationSeconds / 60);
        const seconds = durationSeconds % 60;
        const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        
        // Statistics container
        const statsContainer = document.createElement('div');
        statsContainer.style.cssText = `
            background: var(--viewer-description-bg);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
            width: 80%;
            max-width: 600px;
        `;
        
        const statsTitle = document.createElement('h3');
        statsTitle.textContent = 'Your Results';
        statsTitle.style.cssText = 'margin: 0 0 15px 0; font-size: 18px; font-weight: 600;';
        statsContainer.appendChild(statsTitle);
        
        const timeStats = document.createElement('div');
        timeStats.style.cssText = 'font-size: 24px; font-weight: bold; color: var(--viewer-intro-button-bg); margin-bottom: 10px;';
        timeStats.textContent = `Completed in ${timeString}`;
        statsContainer.appendChild(timeStats);
        
        const stepsStats = document.createElement('div');
        stepsStats.style.cssText = 'font-size: 14px; color: var(--viewer-text); opacity: 0.8;';
        stepsStats.textContent = `${this.totalSteps} steps • ${this.clickCount} clicks`;
        statsContainer.appendChild(stepsStats);
        
        endPage.appendChild(statsContainer);
        // Instructions text
        const instructionsText = document.createElement('p');
        instructionsText.style.cssText = 'margin: 20px 0; line-height: 1.6; font-size: 14px;';
        instructionsText.textContent = 'If you would like to practice again or review the steps, simply click "Try Again" below.';
        endPage.appendChild(instructionsText);
        
        // Button container for centering
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; justify-content: center; margin: 15px 0;';
        
        // Try again button
        const tryAgainButton = document.createElement('button');
        tryAgainButton.textContent = 'Try Again';
        tryAgainButton.className = 'viewer-button';
        tryAgainButton.style.cssText = 'margin-right: 10px; background: var(--viewer-button-bg); color: var(--viewer-text);';
        tryAgainButton.onclick = () => {
            this.currentImageIndex = 0;
            this.currentBoxIndex = 0;
            this.startTime = Date.now(); // Reset timer
            this.clickCount = 0; // Reset click count
            this.completed = false;
            
            // Reset navigation tracking
            this.visitedPositions.clear();
            this.maxVisitedImageIndex = 0;
            this.maxVisitedBoxIndex = 0;
            
            this.showGroup(this.currentGroup);
        };
        buttonContainer.appendChild(tryAgainButton);
        endPage.appendChild(buttonContainer);
        
        // Continue instructions
        const continueText = document.createElement('p');
        continueText.style.cssText = 'margin-top: 30px; font-size: 13px; color: var(--viewer-text); opacity: 0.8; line-height: 1.5;';
        continueText.innerHTML = 'Or click the blue <strong>"Continue"</strong> button in the top right corner to proceed to the next section.';
        endPage.appendChild(continueText);
        
        this.contentContainer.appendChild(endPage);
    }

    

    onComplete(callback) {
        this.onCompleteCallbacks.push(callback);
    }
    
    reset() {
        this.currentImageIndex = 0;
        this.currentBoxIndex = 0;
        this.demoStarted = false;
        this.completed = false;
        
        // Reset navigation tracking
        this.visitedPositions.clear();
        this.maxVisitedImageIndex = 0;
        this.maxVisitedBoxIndex = 0;
        
        if (this.currentGroup) {
            this.showGroup(this.currentGroup);
        }
    }
}

export default ImageViewerStandalone;
class MindMap {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.canvasContainer = document.getElementById('canvas-container');
        this.connectionsLayer = document.getElementById('connections');
        this.modal = document.getElementById('node-modal');
        
        this.nodes = new Map();
        this.connections = [];
        this.nextNodeId = 1;
        
        this.scale = 1;    // Start with normal scale
        this.panX = 0;     // No offset initially
        this.panY = 0;
        this.isPanning = false;
        this.startPanX = 0;
        this.startPanY = 0;
        this.startMouseX = 0;
        this.startMouseY = 0;
        
        this.connectionMode = false;
        this.selectedNode = null;
        this.connectingFrom = null;
        
        this.currentNodeType = 'primer';
        this.editingNodeId = null;
        
        this.init();
        this.loadFromStorage();
    }
    
    init() {
        this.setupEventListeners();
        this.updateCanvasTransform();
    }
    
    setupEventListeners() {
        // Button events
        document.getElementById('add-primer').addEventListener('click', () => this.showNodeModal('primer'));
        document.getElementById('add-deep-dive').addEventListener('click', () => this.showNodeModal('deep-dive'));
        document.getElementById('toggle-connection').addEventListener('click', () => this.toggleConnectionMode());
        
        // Line type toggle
        document.getElementById('line-type-checkbox').addEventListener('change', (e) => this.updateToggleText(e.target.checked));
        
        // Zoom controls
        document.getElementById('zoom-in').addEventListener('click', () => this.zoom(1.2));
        document.getElementById('zoom-out').addEventListener('click', () => this.zoom(0.8));
        document.getElementById('reset-view').addEventListener('click', () => this.resetView());
        
        // Modal events
        document.getElementById('save-node').addEventListener('click', () => this.saveNode());
        document.getElementById('cancel-node').addEventListener('click', () => this.hideNodeModal());
        
        // Pan and zoom
        this.canvasContainer.addEventListener('mousedown', (e) => this.startPan(e));
        this.canvasContainer.addEventListener('mousemove', (e) => this.updatePan(e));
        this.canvasContainer.addEventListener('mouseup', () => this.endPan());
        this.canvasContainer.addEventListener('wheel', (e) => this.handleWheel(e));
        
        // Prevent context menu
        this.canvasContainer.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Modal close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.hideNodeModal();
        });
        
        // Keyboard shortcuts - make sure the element can receive focus
        document.addEventListener('keydown', (e) => this.handleKeydown(e));
        
        // Make sure the canvas container can receive focus for keyboard events
        this.canvasContainer.setAttribute('tabindex', '0');
        this.canvasContainer.addEventListener('keydown', (e) => this.handleKeydown(e));
    }
    
    showNodeModal(type) {
        this.currentNodeType = type;
        this.editingNodeId = null;
        document.getElementById('modal-title').textContent = 
            type === 'primer' ? 'Add New Primer' : 'Add New Deep Dive';
        document.getElementById('node-title').value = '';
        document.getElementById('node-description').value = '';
        document.getElementById('node-author').value = '';
        document.getElementById('node-link').value = '';
        this.modal.classList.remove('hidden');
        document.getElementById('node-title').focus();
    }
    
    hideNodeModal() {
        this.modal.classList.add('hidden');
    }
    
    saveNode() {
        const title = document.getElementById('node-title').value.trim();
        const description = document.getElementById('node-description').value.trim();
        const author = document.getElementById('node-author').value.trim();
        const link = document.getElementById('node-link').value.trim();
        
        if (!title) {
            alert('Please enter a title');
            return;
        }
        
        if (this.editingNodeId) {
            // Update existing node
            this.updateNode(this.editingNodeId, title, description, author, link);
        } else {
            // Create new node
            const centerX = (this.canvasContainer.offsetWidth / 2 - this.panX) / this.scale + 2000;
            const centerY = (this.canvasContainer.offsetHeight / 2 - this.panY) / this.scale + 2000;
            this.createNode(title, description, this.currentNodeType, centerX, centerY, author, link);
        }
        
        this.hideNodeModal();
    }
    
    showEditNodeModal(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        this.editingNodeId = nodeId;
        document.getElementById('modal-title').textContent = 'Edit Node';
        document.getElementById('node-title').value = node.title;
        document.getElementById('node-description').value = node.description;
        document.getElementById('node-author').value = node.author || '';
        document.getElementById('node-link').value = node.link || '';
        this.modal.classList.remove('hidden');
        document.getElementById('node-title').focus();
    }
    
    updateNode(nodeId, title, description, author, link) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        // Update the node data
        node.title = title;
        node.description = description;
        node.author = author;
        node.link = link;
        
        // Update the DOM elements
        const titleElement = node.element.querySelector('.node-title');
        const descElement = node.element.querySelector('.node-description');
        
        titleElement.textContent = title;
        descElement.textContent = description;
        
        // Remove existing author and link elements
        const existingAuthor = node.element.querySelector('.node-author');
        const existingLink = node.element.querySelector('.link-btn');
        
        if (existingAuthor) existingAuthor.remove();
        if (existingLink) existingLink.remove();
        
        // Add new author tag if provided
        if (author) {
            const authorTag = document.createElement('div');
            authorTag.className = 'node-author';
            authorTag.textContent = author;
            authorTag.title = `Author: ${author}`;
            node.element.appendChild(authorTag);
        }
        
        // Add new link button if provided
        if (link) {
            const linkBtn = document.createElement('div');
            linkBtn.className = 'link-btn';
            linkBtn.textContent = '🔗';
            linkBtn.title = 'Open presentation/document';
            linkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(link, '_blank');
            });
            node.element.appendChild(linkBtn);
        }
        
        this.saveToStorage();
    }
    
    createNode(title, description, type, x, y, author = '', link = '') {
        return this.createNodeWithId(this.nextNodeId++, title, description, type, x, y, author, link);
    }
    
    createNodeWithId(nodeId, title, description, type, x, y, author = '', link = '') {
        const nodeElement = document.createElement('div');
        nodeElement.className = `node ${type}`;
        nodeElement.style.left = x + 'px';
        nodeElement.style.top = y + 'px';
        
        const typeLabel = document.createElement('div');
        typeLabel.className = 'node-type';
        typeLabel.textContent = type === 'primer' ? 'PRIMER' : 'DEEP DIVE';
        
        const titleElement = document.createElement('div');
        titleElement.className = 'node-title';
        titleElement.textContent = title;
        
        const descElement = document.createElement('div');
        descElement.className = 'node-description';
        descElement.textContent = description;
        
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '×';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteNodeWithConfirmation(nodeId);
        });
        
        const infoBtn = document.createElement('div');
        infoBtn.className = 'info-btn';
        infoBtn.textContent = 'i';
        infoBtn.title = 'Edit node information';
        infoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showEditNodeModal(nodeId);
        });
        
        // Add link button if link exists
        if (link) {
            const linkBtn = document.createElement('div');
            linkBtn.className = 'link-btn';
            linkBtn.textContent = '🔗';
            linkBtn.title = 'Open presentation/document';
            linkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.open(link, '_blank');
            });
            nodeElement.appendChild(linkBtn);
        }
        
        // Add author tag if author exists
        if (author) {
            const authorTag = document.createElement('div');
            authorTag.className = 'node-author';
            authorTag.textContent = author;
            authorTag.title = `Author: ${author}`;
            nodeElement.appendChild(authorTag);
        }
        
        nodeElement.appendChild(typeLabel);
        nodeElement.appendChild(titleElement);
        nodeElement.appendChild(descElement);
        nodeElement.appendChild(deleteBtn);
        nodeElement.appendChild(infoBtn);
        
        nodeElement.addEventListener('mousedown', (e) => this.startDragNode(e, nodeId));
        nodeElement.addEventListener('click', (e) => this.selectNode(e, nodeId));
        
        this.canvas.appendChild(nodeElement);
        
        this.nodes.set(nodeId, {
            id: nodeId,
            element: nodeElement,
            title,
            description,
            type,
            x,
            y,
            author,
            link
        });
        
        this.saveToStorage();
        return nodeId;
    }
    
    startDragNode(e, nodeId) {
        if (this.connectionMode) {
            e.stopPropagation();
            e.preventDefault();
            this.handleConnectionClick(nodeId);
            return;
        }
        
        
        e.stopPropagation();
        const node = this.nodes.get(nodeId);
        node.isDragging = true;
        node.startX = e.clientX;
        node.startY = e.clientY;
        node.startNodeX = node.x;
        node.startNodeY = node.y;
        
        const handleMouseMove = (e) => {
            if (!node.isDragging) return;
            
            const deltaX = (e.clientX - node.startX) / this.scale;
            const deltaY = (e.clientY - node.startY) / this.scale;
            
            node.x = node.startNodeX + deltaX;
            node.y = node.startNodeY + deltaY;
            
            node.element.style.left = node.x + 'px';
            node.element.style.top = node.y + 'px';
            
            this.updateConnections();
        };
        
        const handleMouseUp = () => {
            node.isDragging = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            this.saveToStorage();
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }
    
    selectNode(e, nodeId) {
        if (this.connectionMode) return;
        
        // Clear previous selection
        if (this.selectedNode) {
            this.nodes.get(this.selectedNode).element.classList.remove('selected');
        }
        
        this.selectedNode = nodeId;
        this.nodes.get(nodeId).element.classList.add('selected');
    }
    
    toggleConnectionMode() {
        this.connectionMode = !this.connectionMode;
        const btn = document.getElementById('toggle-connection');
        const lineToggle = document.getElementById('line-type-toggle');
        
        if (this.connectionMode) {
            btn.classList.add('active');
            btn.textContent = 'Exit Connection';
            this.canvasContainer.style.cursor = 'crosshair';
            lineToggle.classList.remove('hidden');
            this.showInstructions('Click two nodes to connect them');
        } else {
            btn.classList.remove('active');
            btn.textContent = 'Connection Mode';
            this.canvasContainer.style.cursor = 'grab';
            lineToggle.classList.add('hidden');
            this.connectingFrom = null;
            this.clearNodeSelection();
            this.hideInstructions();
        }
    }
    
    handleConnectionClick(nodeId) {
        console.log('Connection click on node:', nodeId, 'connectingFrom:', this.connectingFrom);
        
        if (!this.connectingFrom) {
            // First click - select starting node
            this.connectingFrom = nodeId;
            this.nodes.get(nodeId).element.classList.add('selected');
            this.showInstructions('Now click the second node to connect');
            console.log('First node selected:', nodeId);
        } else if (this.connectingFrom !== nodeId) {
            // Second click - create connection
            const lineType = document.getElementById('line-type-checkbox').checked ? 'dotted' : 'solid';
            console.log('Creating connection from', this.connectingFrom, 'to', nodeId, 'type:', lineType);
            this.createConnection(this.connectingFrom, nodeId, lineType);
            this.clearNodeSelection();
            this.connectingFrom = null;
            this.showInstructions('Click two nodes to connect them');
        } else {
            // Clicked same node - deselect
            console.log('Deselecting node:', nodeId);
            this.clearNodeSelection();
            this.connectingFrom = null;
            this.showInstructions('Click two nodes to connect them');
        }
    }
    
    createConnection(fromId, toId, type = 'solid') {
        // Check if connection already exists
        const existingConnection = this.connections.find(conn => 
            (conn.from === fromId && conn.to === toId) || 
            (conn.from === toId && conn.to === fromId)
        );
        
        if (existingConnection) return; // Don't create duplicate connections
        
        const connection = {
            id: Date.now(),
            from: fromId,
            to: toId,
            type: type
        };
        
        this.connections.push(connection);
        this.updateConnections();
        this.saveToStorage();
    }
    
    updateConnections() {
        this.connectionsLayer.innerHTML = '';
        
        this.connections.forEach(connection => {
            const fromNode = this.nodes.get(connection.from);
            const toNode = this.nodes.get(connection.to);
            
            if (!fromNode || !toNode) return;
            
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            const fromCenterX = fromNode.x + fromNode.element.offsetWidth / 2;
            const fromCenterY = fromNode.y + fromNode.element.offsetHeight / 2;
            const toCenterX = toNode.x + toNode.element.offsetWidth / 2;
            const toCenterY = toNode.y + toNode.element.offsetHeight / 2;
            
            line.setAttribute('x1', fromCenterX);
            line.setAttribute('y1', fromCenterY);
            line.setAttribute('x2', toCenterX);
            line.setAttribute('y2', toCenterY);
            line.setAttribute('class', `connection-line connection-${connection.type}`);
            
            this.connectionsLayer.appendChild(line);
        });
    }
    
    removePreviewLine() {
        const preview = this.connectionsLayer.querySelector('.connection-preview');
        if (preview) preview.remove();
    }
    
    showInstructions(text) {
        this.hideInstructions();
        this.instructionsElement = document.createElement('div');
        this.instructionsElement.className = 'connection-instructions';
        this.instructionsElement.textContent = text;
        document.body.appendChild(this.instructionsElement);
    }
    
    hideInstructions() {
        if (this.instructionsElement) {
            this.instructionsElement.remove();
            this.instructionsElement = null;
        }
    }
    
    clearNodeSelection() {
        this.nodes.forEach(node => {
            node.element.classList.remove('selected', 'hub-node');
        });
    }
    
    updateToggleText(isDotted) {
        const toggleText = document.querySelector('.toggle-text');
        toggleText.textContent = isDotted ? 'Dotted' : 'Solid';
    }
    
    
    startPan(e) {
        if (e.target.closest('.node') || this.connectionMode) return;
        
        this.isPanning = true;
        this.startPanX = this.panX;
        this.startPanY = this.panY;
        this.startMouseX = e.clientX;
        this.startMouseY = e.clientY;
        this.canvasContainer.classList.add('panning');
    }
    
    updatePan(e) {
        if (!this.isPanning) return;
        
        const deltaX = e.clientX - this.startMouseX;
        const deltaY = e.clientY - this.startMouseY;
        
        this.panX = this.startPanX + deltaX;
        this.panY = this.startPanY + deltaY;
        
        this.updateCanvasTransform();
    }
    
    endPan() {
        this.isPanning = false;
        this.canvasContainer.classList.remove('panning');
    }
    
    handleWheel(e) {
        e.preventDefault();
        const zoomIntensity = 0.02; // Further reduced for much smoother zooming
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        
        const newScale = Math.min(Math.max(0.1, this.scale * zoom), 3);
        
        if (newScale !== this.scale) {
            const scaleDiff = newScale / this.scale;
            
            // Get the center of the content area instead of mouse position
            const contentCenter = this.getContentCenter();
            const rect = this.canvasContainer.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            // If we have content, zoom toward content center, otherwise use screen center
            const targetX = contentCenter ? contentCenter.x * this.scale + this.panX : centerX;
            const targetY = contentCenter ? contentCenter.y * this.scale + this.panY : centerY;
            
            this.panX = targetX - (targetX - this.panX) * scaleDiff;
            this.panY = targetY - (targetY - this.panY) * scaleDiff;
            this.scale = newScale;
            
            this.updateCanvasTransform();
        }
    }
    
    getContentCenter() {
        if (this.nodes.size === 0) return null;
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.nodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + 200); // approximate node width
            maxY = Math.max(maxY, node.y + 100); // approximate node height
        });
        
        return {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2
        };
    }
    
    zoom(factor) {
        const rect = this.canvasContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const newScale = Math.min(Math.max(0.1, this.scale * factor), 3);
        
        if (newScale !== this.scale) {
            const scaleDiff = newScale / this.scale;
            
            this.panX = centerX - (centerX - this.panX) * scaleDiff;
            this.panY = centerY - (centerY - this.panY) * scaleDiff;
            this.scale = newScale;
            
            this.updateCanvasTransform();
        }
    }
    
    resetView() {
        this.fitToContent();
    }
    
    fitToContent() {
        if (this.nodes.size === 0) {
            // Default view for empty canvas
            this.scale = 0.5;
            this.panX = 200;
            this.panY = 100;
            this.updateCanvasTransform();
            return;
        }
        
        // Simple approach - just center on the content and set reasonable scale
        const contentCenter = this.getContentCenter();
        if (!contentCenter) {
            this.scale = 0.5;
            this.panX = 200;
            this.panY = 100;
            this.updateCanvasTransform();
            return;
        }
        
        const containerRect = this.canvasContainer.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;
        
        // Set a reasonable zoom level
        this.scale = 0.4; // Zoom out to see more content
        
        // Center the content in the viewport
        this.panX = centerX - contentCenter.x * this.scale;
        this.panY = centerY - contentCenter.y * this.scale;
        
        this.updateCanvasTransform();
    }
    
    updateCanvasTransform() {
        const transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
        console.log('Applying transform:', transform, 'to canvas with', this.nodes.size, 'nodes');
        this.canvas.style.transform = transform;
        this.connectionsLayer.style.transform = transform;
    }
    
    clearCanvas() {
        if (confirm('Are you sure you want to clear all nodes and connections?')) {
            this.nodes.clear();
            this.connections = [];
            this.canvas.innerHTML = '';
            this.connectionsLayer.innerHTML = '';
            this.nextNodeId = 1;
            this.selectedNode = null;
            this.saveToStorage();
        }
    }
    
    handleKeydown(e) {
        if (e.key === 'Escape') {
            if (this.connectionMode) {
                this.toggleConnectionMode();
            } else if (!this.modal.classList.contains('hidden')) {
                this.hideNodeModal();
            }
        }
    }
    
    deleteNodeWithConfirmation(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        
        if (confirm(`Delete "${node.title}" and all its connections?`)) {
            node.element.remove();
            this.nodes.delete(nodeId);
            this.connections = this.connections.filter(
                conn => conn.from !== nodeId && conn.to !== nodeId
            );
            this.updateConnections();
            this.selectedNode = null;
            this.saveToStorage();
        }
    }
    
    
    saveToStorage() {
        const data = {
            nodes: Array.from(this.nodes.values()).map(node => ({
                id: node.id,
                title: node.title,
                description: node.description,
                type: node.type,
                x: node.x,
                y: node.y,
                author: node.author || '',
                link: node.link || ''
            })),
            connections: this.connections,
            nextNodeId: this.nextNodeId
        };
        
        localStorage.setItem('mindMapData', JSON.stringify(data));
    }
    
    loadFromStorage() {
        const data = localStorage.getItem('mindMapData');
        
        if (!data) {
            // Load default sample data if no saved data exists
            this.loadDefaultData();
            return;
        }
        
        try {
            const parsed = JSON.parse(data);
            
            // Set the next node ID to be higher than any existing ID
            let maxId = 0;
            parsed.nodes?.forEach(nodeData => {
                if (nodeData.id > maxId) maxId = nodeData.id;
            });
            this.nextNodeId = maxId + 1;
            
            // Load nodes with their original IDs
            parsed.nodes?.forEach(nodeData => {
                this.createNodeWithId(
                    nodeData.id,
                    nodeData.title,
                    nodeData.description,
                    nodeData.type,
                    nodeData.x,
                    nodeData.y,
                    nodeData.author || '',
                    nodeData.link || ''
                );
            });
            
            // Load connections
            this.connections = parsed.connections || [];
            this.updateConnections();
        } catch (e) {
            console.error('Failed to load saved data:', e);
            this.loadDefaultData();
        }
    }
    
    loadDefaultData() {
        const defaultData = {"nodes":[{"id":1,"title":"Energy Transition","description":"Broad topic of the energy transition underway.","type":"primer","x":720,"y":310.5,"author":"","link":""},{"id":6,"title":"Electrical Grid","description":"","type":"deep-dive","x":-411.18478091639645,"y":93.9396302268625,"author":"","link":""},{"id":9,"title":"Energy","description":"","type":"primer","x":2158,"y":2182.5,"author":"","link":""},{"id":10,"title":"Electrical Grid","description":"","type":"deep-dive","x":2064,"y":2072.5,"author":"Curt","link":"https://www.figma.com/slides/VlsnEFi8DyhagwWrCNnKyE/LWM---The-Grid?node-id=2-122&t=5TD4Wia7iOrieQaQ-1"},{"id":11,"title":"Nuclear","description":"","type":"deep-dive","x":2249,"y":2079.5,"author":"","link":""},{"id":12,"title":"Batteries","description":"","type":"deep-dive","x":2081,"y":2288.5,"author":"","link":""},{"id":41,"title":"LNG","description":"","type":"deep-dive","x":2330,"y":2248.5,"author":"","link":""},{"id":42,"title":"Healthcare","description":"","type":"primer","x":2772.5,"y":2220,"author":"","link":""},{"id":43,"title":"Longevity","description":"","type":"deep-dive","x":2626.5,"y":2113,"author":"","link":""},{"id":46,"title":"GLP-1s","description":"","type":"deep-dive","x":2834.5,"y":2093,"author":"","link":""},{"id":47,"title":"China","description":"","type":"primer","x":2731.5,"y":2579,"author":"","link":""},{"id":48,"title":"Technology","description":"","type":"deep-dive","x":2568.5,"y":2685,"author":"","link":""},{"id":49,"title":"Real Estate","description":"","type":"deep-dive","x":2896.5,"y":2486,"author":"","link":""},{"id":50,"title":"Taiwan","description":"","type":"deep-dive","x":2881.5,"y":2679,"author":"","link":""},{"id":52,"title":"AI","description":"","type":"primer","x":2219.5,"y":2543,"author":"","link":""},{"id":53,"title":"Datacenters","description":"","type":"deep-dive","x":2274.5,"y":2366,"author":"","link":""},{"id":54,"title":"SaaS Disruption","description":"","type":"deep-dive","x":2051.5,"y":2654,"author":"","link":""},{"id":55,"title":"Foundation Models","description":"","type":"deep-dive","x":2401.5,"y":2448,"author":"","link":""},{"id":56,"title":"GPUs/TPUs","description":"","type":"deep-dive","x":2049.5,"y":2469,"author":"","link":""},{"id":57,"title":"Marijuana & Psychedelics","description":"","type":"deep-dive","x":2968.5,"y":2200,"author":"","link":""}],"connections":[{"id":1754676518116,"from":42,"to":46,"type":"solid"},{"id":1754676520833,"from":42,"to":43,"type":"solid"},{"id":1754676536034,"from":9,"to":11,"type":"solid"},{"id":1754676537263,"from":9,"to":10,"type":"solid"},{"id":1754676538466,"from":9,"to":12,"type":"solid"},{"id":1754676540021,"from":9,"to":41,"type":"solid"},{"id":1754676544302,"from":42,"to":9,"type":"dotted"},{"id":1754677686773,"from":47,"to":49,"type":"solid"},{"id":1754677688119,"from":47,"to":50,"type":"solid"},{"id":1754677689763,"from":47,"to":48,"type":"solid"},{"id":1754677752279,"from":9,"to":53,"type":"solid"},{"id":1754677754137,"from":52,"to":53,"type":"solid"},{"id":1754678256860,"from":52,"to":54,"type":"solid"},{"id":1754678258445,"from":52,"to":55,"type":"solid"},{"id":1754678262409,"from":52,"to":47,"type":"dotted"},{"id":1754678299502,"from":56,"to":52,"type":"solid"},{"id":1754678348276,"from":42,"to":57,"type":"solid"},{"id":1754678474753,"from":9,"to":52,"type":"dotted"}],"nextNodeId":58};
        
        
        // Set the next node ID
        this.nextNodeId = defaultData.nextNodeId;
        
        // Load default nodes
        defaultData.nodes.forEach(nodeData => {
            this.createNodeWithId(
                nodeData.id,
                nodeData.title,
                nodeData.description,
                nodeData.type,
                nodeData.x,
                nodeData.y,
                nodeData.author || '',
                nodeData.link || ''
            );
        });
        
        
        // Load default connections
        this.connections = defaultData.connections;
        this.updateConnections();
        
        // Save this default data to localStorage for future visits
        this.saveToStorage();
    }
}

// Initialize the mind map when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MindMap();
});
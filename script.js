class MindMap {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.canvasContainer = document.getElementById('canvas-container');
        this.connectionsLayer = document.getElementById('connections');
        this.modal = document.getElementById('node-modal');
        
        this.nodes = new Map();
        this.connections = [];
        this.nextNodeId = 1;
        
        this.scale = 1;
        this.panX = 0;
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
        const zoomIntensity = 0.1;
        const wheel = e.deltaY < 0 ? 1 : -1;
        const zoom = Math.exp(wheel * zoomIntensity);
        
        const rect = this.canvasContainer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const newScale = Math.min(Math.max(0.1, this.scale * zoom), 3);
        
        if (newScale !== this.scale) {
            const scaleDiff = newScale / this.scale;
            
            this.panX = mouseX - (mouseX - this.panX) * scaleDiff;
            this.panY = mouseY - (mouseY - this.panY) * scaleDiff;
            this.scale = newScale;
            
            this.updateCanvasTransform();
        }
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
        this.scale = 1;
        this.panX = 0;
        this.panY = 0;
        this.updateCanvasTransform();
    }
    
    updateCanvasTransform() {
        const transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
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
        if (!data) return;
        
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
        }
    }
}

// Initialize the mind map when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MindMap();
});
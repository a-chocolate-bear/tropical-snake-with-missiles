class SnakeGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = 400;
        this.canvas.height = 400;
        
        this.gridSize = 20;
        this.snake = [{x: 5, y: 5}];
        this.food = this.generateFood();
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.highScore = localStorage.getItem('snakeHighScore') || 0;
        this.gameLoop = null;
        this.gameStarted = false;
        this.lastUpdate = 0;
        this.initialInterval = 150;
        this.updateInterval = this.initialInterval; // Controls snake speed (milliseconds between moves)
        this.speedIncreaseRate = 0.00025; // 0.025% increase
        
        // Session tracking
        this.sessionCount = 0;
        this.sessionScores = [];
        
        // Add obstacles array to track moving points
        this.obstacles = [];
        this.obstacleSpeed = 2;
        this.foodEatenCount = 0;
        this.obstaclesPerSpawn = 1;

        // Initialize audio context and sounds
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {
            turn: this.createSound(200),
            food: this.createSound(300),
            gameOver: this.createSound(100)
        };

        // Event listeners
        document.addEventListener('keydown', this.handleKeyPress.bind(this));
        document.getElementById('startButton').addEventListener('click', this.startGame.bind(this));

        // Initial render
        this.updateScore();
        this.draw();
    }

    createSound(frequency) {
        return () => {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
            
            gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.1);
        };
    }

    generateFood() {
        let food;
        do {
            food = {
                x: Math.floor(Math.random() * (this.canvas.width / this.gridSize)),
                y: Math.floor(Math.random() * (this.canvas.height / this.gridSize))
            };
        } while (this.snake.some(segment => segment.x === food.x && segment.y === food.y));
        return food;
    }

    handleKeyPress(event) {
        const key = event.key.toLowerCase();
        const directions = {
            arrowup: 'up',
            arrowdown: 'down',
            arrowleft: 'left',
            arrowright: 'right',
            w: 'up',
            s: 'down',
            a: 'left',
            d: 'right'
        };

        if (directions[key] && this.isValidDirection(directions[key])) {
            if (this.direction !== directions[key]) {
                this.sounds.turn();
            }
            this.nextDirection = directions[key];
        }
    }

    isValidDirection(newDirection) {
        const opposites = {
            up: 'down',
            down: 'up',
            left: 'right',
            right: 'left'
        };
        return opposites[newDirection] !== this.direction;
    }

    generateObstacle() {
        // Randomly choose a side to spawn from (0: top, 1: right, 2: bottom, 3: left)
        const side = Math.floor(Math.random() * 4);
        let x, y, dx, dy;
        
        switch(side) {
            case 0: // top
                x = Math.random() * this.canvas.width;
                y = 0;
                dx = Math.random() * 2 - 1; // Random direction between -1 and 1
                dy = Math.random() * 0.5 + 0.5; // Always move downward
                break;
            case 1: // right
                x = this.canvas.width;
                y = Math.random() * this.canvas.height;
                dx = -(Math.random() * 0.5 + 0.5); // Always move leftward
                dy = Math.random() * 2 - 1;
                break;
            case 2: // bottom
                x = Math.random() * this.canvas.width;
                y = this.canvas.height;
                dx = Math.random() * 2 - 1;
                dy = -(Math.random() * 0.5 + 0.5); // Always move upward
                break;
            case 3: // left
                x = 0;
                y = Math.random() * this.canvas.height;
                dx = Math.random() * 0.5 + 0.5; // Always move rightward
                dy = Math.random() * 2 - 1;
                break;
        }

        // Normalize the direction vector
        const length = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / length) * this.obstacleSpeed;
        dy = (dy / length) * this.obstacleSpeed;

        return { x, y, dx, dy };
    }

    updateObstacles() {
        // Update obstacle positions
        this.obstacles = this.obstacles.filter(obstacle => {
            obstacle.x += obstacle.dx;
            obstacle.y += obstacle.dy;

            // Remove obstacles that are off screen
            return !(obstacle.x < 0 || obstacle.x > this.canvas.width ||
                    obstacle.y < 0 || obstacle.y > this.canvas.height);
        });

        // Check for collision with snake
        const snakeHit = this.obstacles.some(obstacle => {
            return this.snake.some(segment => {
                const segmentBox = {
                    left: segment.x * this.gridSize,
                    right: (segment.x + 1) * this.gridSize,
                    top: segment.y * this.gridSize,
                    bottom: (segment.y + 1) * this.gridSize
                };

                return obstacle.x >= segmentBox.left && obstacle.x <= segmentBox.right &&
                       obstacle.y >= segmentBox.top && obstacle.y <= segmentBox.bottom;
            });
        });

        if (snakeHit) {
            this.gameOver();
        }
    }

    updateSessionHistory() {
        const sessionScoresElement = document.getElementById('sessionScores');
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td>${this.sessionCount}</td>
            <td>${this.score}</td>
        `;
        
        // Add new row at the beginning of the table
        if (sessionScoresElement.firstChild) {
            sessionScoresElement.insertBefore(newRow, sessionScoresElement.firstChild);
        } else {
            sessionScoresElement.appendChild(newRow);
        }

        // Keep only the last 10 sessions
        while (sessionScoresElement.children.length > 10) {
            sessionScoresElement.removeChild(sessionScoresElement.lastChild);
        }
    }

    startGame() {
        if (this.gameLoop) {
            cancelAnimationFrame(this.gameLoop);
        }
        
        this.sessionCount++;
        this.snake = [{x: 5, y: 5}];
        this.direction = 'right';
        this.nextDirection = 'right';
        this.score = 0;
        this.updateScore();
        this.food = this.generateFood();
        this.gameStarted = true;
        this.lastUpdate = 0;
        this.updateInterval = this.initialInterval; // Reset speed to initial value
        this.obstacles = []; // Clear obstacles
        this.foodEatenCount = 0;
        this.obstaclesPerSpawn = 1;
        document.getElementById('gameOver').classList.add('hidden');
        
        this.gameLoop = requestAnimationFrame(this.update.bind(this));
    }

    update(timestamp) {
        if (!this.gameStarted) return;

        // Update and check obstacles every frame
        this.updateObstacles();

        // Only update snake position after updateInterval has passed
        if (timestamp - this.lastUpdate >= this.updateInterval) {
            const head = {...this.snake[0]};
            this.direction = this.nextDirection;

            switch (this.direction) {
                case 'up': head.y--; break;
                case 'down': head.y++; break;
                case 'left': head.x--; break;
                case 'right': head.x++; break;
            }

            // Check collision with walls
            if (head.x < 0 || head.x >= this.canvas.width / this.gridSize ||
                head.y < 0 || head.y >= this.canvas.height / this.gridSize ||
                this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
                this.gameOver();
                return;
            }

            this.snake.unshift(head);

            // Check if snake ate food
            if (head.x === this.food.x && head.y === this.food.y) {
                this.score += 10;
                this.updateScore();
                this.food = this.generateFood();
                this.sounds.food();
                
                // Increase speed
                this.updateInterval *= (1 - this.speedIncreaseRate);
                
                // Update food counter and check for obstacle increase
                this.foodEatenCount++;
                if (this.foodEatenCount % 3 === 0) {
                    this.obstaclesPerSpawn++;
                }
                
                // Add new obstacles based on current obstaclesPerSpawn
                for (let i = 0; i < this.obstaclesPerSpawn; i++) {
                    this.obstacles.push(this.generateObstacle());
                }
            } else {
                this.snake.pop();
            }

            this.lastUpdate = timestamp;
        }

        this.draw();
        this.gameLoop = requestAnimationFrame(this.update.bind(this));
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw snake
        this.ctx.fillStyle = '#FF7675';
        this.snake.forEach((segment, index) => {
            this.ctx.fillRect(
                segment.x * this.gridSize,
                segment.y * this.gridSize,
                this.gridSize - 1,
                this.gridSize - 1
            );
        });

        // Draw food
        this.ctx.fillStyle = '#FED330';
        this.ctx.fillRect(
            this.food.x * this.gridSize,
            this.food.y * this.gridSize,
            this.gridSize - 1,
            this.gridSize - 1
        );

        // Draw obstacles
        this.ctx.fillStyle = '#6C5CE7';
        this.obstacles.forEach(obstacle => {
            this.ctx.beginPath();
            this.ctx.arc(obstacle.x, obstacle.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    gameOver() {
        this.gameStarted = false;
        this.sounds.gameOver();
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('snakeHighScore', this.highScore);
            document.getElementById('highScore').textContent = this.highScore;
        }
        this.updateSessionHistory();
        document.getElementById('gameOver').classList.remove('hidden');
        cancelAnimationFrame(this.gameLoop);
    }

    updateScore() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('highScore').textContent = this.highScore;
    }
}

// Initialize game
window.onload = () => {
    new SnakeGame();
}; 
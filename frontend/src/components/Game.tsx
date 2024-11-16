"use client";

import { useCharacterSelect } from '@/contexts/CharacterSelectContext';
import {
    AI_MOVE_DURATION_MAX,
    AI_MOVE_DURATION_MIN,
    AI_MOVE_SPEED,
    AI_PAUSE_DURATION_MAX,
    AI_PAUSE_DURATION_MIN,
    ANIMATION_FRAMES,
    CANVAS_HEIGHT,
    CANVAS_WIDTH,
    DEBUG_CHARACTER_SELECT_BOXES,
    DEBUG_WALKABLE_AREAS,
    DIRECTIONS,
    FRAME_DURATION,
    MAP_OFFSET_X,
    MAP_OFFSET_Y,
    PLAYER_MOVE_SPEED,
    SCALE_FACTOR,
    SPRITE_SIZE,
    WALKABLE_AREAS
} from '@/utils/properties';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AgentDetails from './AgentDetails';
import { Character } from './Character';
import CharacterSelect from './CharacterSelect';
import Chat from './Chat';
import { God } from './God';
import NotificationBoard, { NotificationData } from './NotificationBoard';
import RecursiveChat from './RecursiveChat';

// Function to get a random integer between min and max
function getRandomInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Interface for player state
interface PlayerState {
    x: number;
    y: number;
    direction: 'up' | 'down' | 'left' | 'right';
    isMoving: boolean;
    message: string | null;
    messageTimeoutId?: NodeJS.Timeout;
    ai?: {
        action: 'moving' | 'paused';
        actionEndTime: number;
    };
}


// Helper function to check if two bounds overlap
function isOverlapping(
    bounds1: { x: number; y: number; width: number; height: number; },
    bounds2: { x: number; y: number; width: number; height: number; }
): boolean {
    const center1 = {
        x: bounds1.x + bounds1.width / 2,
        y: bounds1.y + bounds1.height / 2
    };

    const center2 = {
        x: bounds2.x + bounds2.width / 2,
        y: bounds2.y + bounds2.height / 2
    };

    // Calculate distance between centers
    const dx = Math.abs(center1.x - center2.x);
    const dy = Math.abs(center1.y - center2.y);

    // Calculate minimum distance required between centers
    const minDistanceX = (bounds1.width + bounds2.width) / 2;
    const minDistanceY = (bounds1.height + bounds2.height) / 2;

    return dx < minDistanceX && dy < minDistanceY;
}

// Function to check if a character would collide with others at the given position
function checkCharacterCollision(
    playerStates: PlayerState[],
    characterIndex: number,
    newX: number,
    newY: number
): boolean {
    // Increase collision box to 95% of character size (up from 90%)
    const width = SPRITE_SIZE * SCALE_FACTOR * 0.95;
    const height = SPRITE_SIZE * SCALE_FACTOR * 0.95;

    const newBounds = {
        x: newX * SCALE_FACTOR + MAP_OFFSET_X,
        y: newY * SCALE_FACTOR + MAP_OFFSET_Y,
        width,
        height,
    };

    return playerStates.some((state, index) => {
        if (index === characterIndex) return false;
        if (!state) return false;

        const otherBounds = {
            x: state.x * SCALE_FACTOR + MAP_OFFSET_X,
            y: state.y * SCALE_FACTOR + MAP_OFFSET_Y,
            width,
            height,
        };

        // Increase buffer zone from 5 to 8 pixels
        const buffer = 8;
        const expandedBounds = {
            x: otherBounds.x - buffer,
            y: otherBounds.y - buffer,
            width: otherBounds.width + buffer * 2,
            height: otherBounds.height + buffer * 2
        };

        return isOverlapping(newBounds, expandedBounds);
    });
}

// Update the isWithinCanvasBounds function
function isWithinCanvasBounds(x: number, y: number): boolean {
    const scaledX = x * SCALE_FACTOR + MAP_OFFSET_X;
    const scaledY = y * SCALE_FACTOR + MAP_OFFSET_Y;
    const characterSize = SPRITE_SIZE * SCALE_FACTOR;
    const buffer = 50; // 50px buffer from edges

    return (
        scaledX >= buffer &&
        scaledX + characterSize <= CANVAS_WIDTH - buffer &&
        scaledY >= buffer &&
        scaledY + characterSize <= CANVAS_HEIGHT - buffer
    );
}

const Game = ({ userId, walletAddress }: { userId: string, walletAddress: string }) => {
    // Refs
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mapRef = useRef<HTMLImageElement | null>(null);
    const lastRenderTimeRef = useRef<number>(0);
    const sessionId = useRef<string>(crypto.randomUUID()).current;
    // State variables
    const [isInitialized, setIsInitialized] = useState(false);
    const [playerStates, setPlayerStates] = useState<PlayerState[]>([]);
    const [controlledCharacterIndex, setControlledCharacterIndex] = useState<number | null>(null);
    const [isInputActive, setIsInputActive] = useState<boolean>(false);
    const [animationFrame, setAnimationFrame] = useState<number>(0);
    const [isHoveredIndex, setIsHoveredIndex] = useState<number | null>(null);
    const [inputValue, setInputValue] = useState<string>('');
    const [chatMode, setChatMode] = useState<'STANDARD' | 'RECURSIVE'>('STANDARD');
    const [notifications, setNotifications] = useState<NotificationData[]>([]);
    const [chatMessages, setChatMessages] = useState<{
        id: string;
        message: string;
        timestamp: Date;
        characterName: string;
    }[]>([]);

    // Store Character instances in a ref to ensure they are only created once
    const charactersRef = useRef<Character[] | null>(null);

    // Add godRef to store the God instance
    const godRef = useRef<God | null>(null);

    const { isOpen } = useCharacterSelect();

    // Stable function references using useCallback
    const handleCharacterMessage = useCallback((index: number, messageChunk: string) => {
        setPlayerStates((prevStates) => {
            const newStates = [...prevStates];
            const currentState = newStates[index];

            // If there's an existing timeout, clear it since we're still receiving chunks
            if (currentState?.messageTimeoutId) {
                clearTimeout(currentState.messageTimeoutId);
            }

            // Set the message in player state (for speech bubble)
            const timeoutId = setTimeout(() => {
                setPlayerStates((states) => {
                    const clearedStates = [...states];
                    if (clearedStates[index]) {
                        clearedStates[index] = {
                            ...clearedStates[index],
                            message: null,
                            messageTimeoutId: undefined,
                        };
                    }
                    return clearedStates;
                });
            }, 8000);

            newStates[index] = {
                ...currentState,
                message: messageChunk,
                messageTimeoutId: timeoutId
            };

            return newStates;
        });

        // Only add non-empty messages to chat history
        if (messageChunk.trim()) {
            const characterName = charactersRef.current?.[index]?.name || `Character ${index}`;
            setChatMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                message: messageChunk,
                timestamp: new Date(),
                characterName: characterName,
            }].slice(-50));
        }
    }, []);

    const handleCharacterError = useCallback((index: number, error: string) => {
        setPlayerStates((prevStates) => {
            const newStates = [...prevStates];
            newStates[index] = {
                ...newStates[index],
                message: error,
            };
            return newStates;
        });

        // Clear the error message after 5 seconds
        setTimeout(() => {
            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                if (newStates[index]) {
                    newStates[index] = {
                        ...newStates[index],
                        message: null,
                    };
                }
                return newStates;
            });
        }, 5000);
    }, []);

    const handleGodMessage = useCallback((message: string) => {
        // Only add God messages to notifications
        setNotifications(prev => [{
            id: crypto.randomUUID(),
            message: message,
            timestamp: new Date(),
            metadata: null,
        }, ...prev].slice(0, 50));
    }, []);

    const handleGodError = useCallback((error: string) => {
        console.error('God error:', error);
    }, []);

    // Draw the game
    const drawGame = useCallback(() => {
        if (!isInitialized) {
            console.debug("drawGame early return because not initialized");
            return;
        }
        const canvas = canvasRef.current;
        const map = mapRef.current;
        const characters = charactersRef.current;


        if (!canvas || !map || !characters || playerStates.length === 0) {
            if (!canvas) console.debug("Missing canvas");
            if (!map) console.debug("Missing map");
            if (!characters) console.debug("Missing characters");
            if (playerStates.length === 0) console.debug("No player states"); // This is the issue
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return;
        }

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw the office map background to fill the entire canvas
        ctx.drawImage(
            map,
            0,  // source x
            0,  // source y
            map.width,  // source width
            map.height, // source height
            0,  // destination x
            0,  // destination y
            CANVAS_WIDTH,  // destination width - fill entire canvas width
            CANVAS_HEIGHT  // destination height - fill entire canvas height
        );

        // Draw walkable areas for debugging
        if (DEBUG_WALKABLE_AREAS) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            WALKABLE_AREAS.forEach((area) => {
                ctx.strokeRect(
                    area.x * SCALE_FACTOR + MAP_OFFSET_X,
                    area.y * SCALE_FACTOR + MAP_OFFSET_Y,
                    area.width * SCALE_FACTOR,
                    area.height * SCALE_FACTOR
                );
            });
        }

        // Draw each character
        characters.forEach((character, index) => {
            const playerState = playerStates[index];

            if (!playerState) {
                return; // Skip this iteration if playerState is not defined
            }

            character.draw(
                ctx,
                playerState.x,
                playerState.y,
                playerState.direction,
                animationFrame,
                playerState.isMoving,
                playerState.message
            );

            const characterX = playerState.x * SCALE_FACTOR + MAP_OFFSET_X;
            const characterY = playerState.y * SCALE_FACTOR + MAP_OFFSET_Y;
            const characterWidth = SPRITE_SIZE * SCALE_FACTOR;
            const characterHeight = SPRITE_SIZE * SCALE_FACTOR;

            // Draw the name above the character if hovered
            if (isHoveredIndex === index && !isInputActive) {
                ctx.fillStyle = 'white';
                ctx.font = '16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const textX = characterX + characterWidth / 2;
                const textY = characterY - 10;

                ctx.fillText(character.name, textX, textY);
            }

            // Highlight the controlled character
            if (controlledCharacterIndex !== null && controlledCharacterIndex === index && DEBUG_CHARACTER_SELECT_BOXES) {
                ctx.strokeStyle = 'yellow';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    characterX,
                    characterY,
                    characterWidth,
                    characterHeight
                );
            }
        });

        if (DEBUG_CHARACTER_SELECT_BOXES && ctx) {
            // Draw collision boxes for all characters
            playerStates.forEach(state => {
                const width = SPRITE_SIZE * SCALE_FACTOR * 1.15;  // Match the new size
                const height = SPRITE_SIZE * SCALE_FACTOR * 1.15;
                const buffer = 14;  // Match the new buffer size

                // Draw character's collision box
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                ctx.strokeRect(
                    state.x * SCALE_FACTOR + MAP_OFFSET_X,
                    state.y * SCALE_FACTOR + MAP_OFFSET_Y,
                    width,
                    height
                );

                // Draw buffer zone
                ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.strokeRect(
                    state.x * SCALE_FACTOR + MAP_OFFSET_X - buffer,
                    state.y * SCALE_FACTOR + MAP_OFFSET_Y - buffer,
                    width + buffer * 2,
                    height + buffer * 2
                );
            });
        }
    }, [
        isInitialized,
        playerStates,
        animationFrame,
        isHoveredIndex,
        isInputActive,
        controlledCharacterIndex,
    ]);

    // Store functions in refs to have stable references
    const drawGameRef = useRef(drawGame);
    const handleCharacterMessageRef = useRef(handleCharacterMessage);
    const handleCharacterErrorRef = useRef(handleCharacterError);
    const handleGodMessageRef = useRef(handleGodMessage);
    const handleGodErrorRef = useRef(handleGodError);

    // Update refs to point to the latest versions
    useEffect(() => {
        drawGameRef.current = drawGame;
        handleCharacterMessageRef.current = handleCharacterMessage;
        handleGodMessageRef.current = handleGodMessage;
        handleGodErrorRef.current = handleGodError;
        handleCharacterErrorRef.current = handleCharacterError;
    }, [drawGame, handleCharacterMessage, handleGodMessage, handleGodError, handleCharacterError]);

    // Initialize characters and load the map
    useEffect(() => {
        let mounted = true;

        const initializeGame = async () => {
            // Initialize characters if not already initialized
            if (!charactersRef.current) {
                console.debug("Initializing characters...");
                charactersRef.current = [
                    new Character(
                        0,
                        'Eric',
                        '/sprite_p1.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                    new Character(
                        1,
                        'Harper',
                        '/sprite_p2.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                    new Character(
                        2,
                        'Rishi',
                        '/sprite_p3.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                    new Character(
                        3,
                        'Yasmin',
                        '/sprite_p4.png',
                        () => {
                            if (mounted) drawGameRef.current();
                        },
                        (index, message) => {
                            handleCharacterMessageRef.current(index, message);
                        },
                        (index, error) => {
                            handleCharacterErrorRef.current(index, error);
                        },
                        sessionId,
                        userId
                    ),
                ];
                // Initialize God and store in ref
                godRef.current = new God(
                    (message) => {
                        console.log(`God received message: ${JSON.stringify(message)}`);
                        handleGodMessageRef.current(message);
                    },
                    (error) => {
                        console.error(`God error: ${JSON.stringify(error)}`);
                        handleGodErrorRef.current(error);
                    },
                    sessionId,
                    userId,
                    walletAddress,
                    chatMode
                );
            }

            // Initialize player states
            const initialPlayerStates: PlayerState[] = [
                {
                    x: 200,
                    y: 600,
                    direction: 'down',
                    isMoving: false,
                    message: null,
                    ai: {
                        action: 'paused',
                        actionEndTime:
                            Date.now() +
                            getRandomInt(AI_PAUSE_DURATION_MIN, AI_PAUSE_DURATION_MAX),
                    },
                },
                {
                    x: 400,
                    y: 600,
                    direction: 'down',
                    isMoving: false,
                    message: null,
                    ai: {
                        action: 'paused',
                        actionEndTime:
                            Date.now() +
                            getRandomInt(AI_PAUSE_DURATION_MIN, AI_PAUSE_DURATION_MAX),
                    },
                },
                {
                    x: 600,
                    y: 600,
                    direction: 'down',
                    isMoving: false,
                    message: null,
                    ai: {
                        action: 'paused',
                        actionEndTime:
                            Date.now() +
                            getRandomInt(AI_PAUSE_DURATION_MIN, AI_PAUSE_DURATION_MAX),
                    },
                },
                {
                    x: 800,
                    y: 600,
                    direction: 'down',
                    isMoving: false,
                    message: null,
                    ai: {
                        action: 'paused',
                        actionEndTime:
                            Date.now() +
                            getRandomInt(AI_PAUSE_DURATION_MIN, AI_PAUSE_DURATION_MAX),
                    },
                }
            ];

            // Load the map image
            const mapImage = new Image();
            mapImage.src = '/industry_office_map.png';
            await new Promise((resolve, reject) => {
                mapImage.onload = () => {
                    resolve(null);
                };
                mapImage.onerror = (error) => {
                    console.error("Failed to load map image:", error);
                    reject(error);
                };
            });

            if (mounted) {
                setPlayerStates(initialPlayerStates);
                mapRef.current = mapImage;
                setIsInitialized(true);

            }
        };

        initializeGame().catch((error) => {
            console.error("Error during game initialization:", error);
        });

        return () => {
            mounted = false;
            // Clean up WebSocket connections and character instances
            if (charactersRef.current) {
                charactersRef.current.forEach(character => character.destroy());
            }
            if (godRef.current) {
                godRef.current.closeWebSocket();
            }
        };
    }, []); // Empty dependency array ensures this runs only once

    useEffect(() => {
        if (godRef.current) {
            godRef.current.setChatMode(chatMode);
        }
    }, [chatMode]);

    // Initialize AI states for uncontrolled characters
    useEffect(() => {
        setPlayerStates((prevStates) =>
            prevStates.map((state, index) => {
                if (
                    controlledCharacterIndex === null ||
                    index !== controlledCharacterIndex
                ) {
                    if (!state.ai) {
                        return {
                            ...state,
                            ai: {
                                action: 'paused',
                                actionEndTime:
                                    Date.now() +
                                    getRandomInt(
                                        AI_PAUSE_DURATION_MIN,
                                        AI_PAUSE_DURATION_MAX
                                    ),
                            },
                        };
                    }
                } else if (index === controlledCharacterIndex && state.ai) {
                    // Remove AI state from the newly controlled character
                    const { ai: _unused, ...rest } = state;
                    return rest;
                }
                return state;
            })
        );
    }, [controlledCharacterIndex]);

    // Animation loop
    useEffect(() => {
        if (!isInitialized) {
            console.debug("Animation loop not started because game is not initialized");
            return;
        }
        let animationId: number;

        const animate = (timestamp: number) => {
            const newPlayerStates = [...playerStates];

            newPlayerStates.forEach((playerState, index) => {
                if (playerState.ai && charactersRef.current) {
                    // AI-controlled character logic
                    if (Date.now() >= playerState.ai.actionEndTime) {
                        // Change action
                        if (playerState.ai.action === 'paused') {
                            // Start moving
                            playerState.ai.action = 'moving';
                            playerState.ai.actionEndTime =
                                Date.now() + getRandomInt(AI_MOVE_DURATION_MIN, AI_MOVE_DURATION_MAX);
                            playerState.direction = DIRECTIONS[getRandomInt(0, DIRECTIONS.length - 1)];
                            playerState.isMoving = true;
                        } else {
                            // Pause
                            playerState.ai.action = 'paused';
                            playerState.ai.actionEndTime =
                                Date.now() + getRandomInt(AI_PAUSE_DURATION_MIN, AI_PAUSE_DURATION_MAX);
                            playerState.isMoving = false;
                            setAnimationFrame(0); // Reset animation frame
                        }
                    }

                    if (playerState.ai.action === 'moving') {
                        const moveDistance = (AI_MOVE_SPEED / SCALE_FACTOR) *
                            ((timestamp - lastRenderTimeRef.current) / FRAME_DURATION);
                        let newX = playerState.x;
                        let newY = playerState.y;

                        // Try movement in current direction
                        switch (playerState.direction) {
                            case 'up':
                                newY -= moveDistance;
                                break;
                            case 'down':
                                newY += moveDistance;
                                break;
                            case 'left':
                                newX -= moveDistance;
                                break;
                            case 'right':
                                newX += moveDistance;
                                break;
                        }

                        const scaledNewX = newX * SCALE_FACTOR + MAP_OFFSET_X;
                        const scaledNewY = newY * SCALE_FACTOR + MAP_OFFSET_Y;

                        // Check both canvas bounds, walkable area, and character collisions
                        if (
                            isWithinCanvasBounds(newX, newY) &&
                            isWalkable(scaledNewX, scaledNewY) &&
                            !checkCharacterCollision(newPlayerStates, index, newX, newY)
                        ) {
                            playerState.x = newX;
                            playerState.y = newY;
                        } else {
                            // On collision, immediately stop and change direction
                            playerState.isMoving = false;
                            playerState.ai.action = 'paused';
                            playerState.ai.actionEndTime = Date.now() + 1000;
                            let newDirection;
                            do {
                                newDirection = DIRECTIONS[getRandomInt(0, DIRECTIONS.length - 1)];
                            } while (newDirection === playerState.direction);
                            playerState.direction = newDirection;
                        }

                        // Update animation frame
                        if (timestamp - lastRenderTimeRef.current >= FRAME_DURATION) {
                            setAnimationFrame((prev) => (prev + 1) % ANIMATION_FRAMES);
                            lastRenderTimeRef.current = timestamp;
                        }
                    }
                }
            });

            setPlayerStates(newPlayerStates);
            drawGame();

            animationId = requestAnimationFrame(animate);
        };

        animationId = requestAnimationFrame(animate);

        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [drawGame, playerStates, isInitialized]);

    // Handle keyboard input for movement and chat
    useEffect(() => {
        if (!isInitialized) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) {
                return;
            }

            if (e.key === 'Enter') {
                if (controlledCharacterIndex !== null) {
                    setIsInputActive((prev) => !prev);
                }
                return;
            }

            if (controlledCharacterIndex === null || !charactersRef.current) return;

            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                const playerState = { ...newStates[controlledCharacterIndex] };

                playerState.isMoving = true;
                const moveDistance = PLAYER_MOVE_SPEED / SCALE_FACTOR;

                let newX = playerState.x;
                let newY = playerState.y;

                switch (e.key) {
                    case 'ArrowUp':
                        newY -= moveDistance;
                        playerState.direction = 'up';
                        break;
                    case 'ArrowDown':
                        newY += moveDistance;
                        playerState.direction = 'down';
                        break;
                    case 'ArrowLeft':
                        newX -= moveDistance;
                        playerState.direction = 'left';
                        break;
                    case 'ArrowRight':
                        newX += moveDistance;
                        playerState.direction = 'right';
                        break;
                    default:
                        return prevStates;
                }

                const scaledNewX = newX * SCALE_FACTOR + MAP_OFFSET_X;
                const scaledNewY = newY * SCALE_FACTOR + MAP_OFFSET_Y;

                // Check both canvas bounds, walkable area, and character collisions
                if (
                    isWithinCanvasBounds(newX, newY) &&
                    isWalkable(scaledNewX, scaledNewY) &&
                    !checkCharacterCollision(newStates, controlledCharacterIndex, newX, newY)
                ) {
                    playerState.x = newX;
                    playerState.y = newY;
                    newStates[controlledCharacterIndex] = playerState;
                    drawGame();
                    return newStates;
                } else {
                    // Add a small "bump" effect by moving slightly in the opposite direction
                    const bumpDistance = 0.9;
                    switch (playerState.direction) {
                        case 'up':
                            playerState.y += bumpDistance;
                            break;
                        case 'down':
                            playerState.y -= bumpDistance;
                            break;
                        case 'left':
                            playerState.x += bumpDistance;
                            break;
                        case 'right':
                            playerState.x -= bumpDistance;
                            break;
                    }
                    newStates[controlledCharacterIndex] = playerState;
                    return newStates;
                }
            });
        };

        const handleKeyUp = () => {
            if (controlledCharacterIndex === null) return;
            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                newStates[controlledCharacterIndex].isMoving = false;
                setAnimationFrame(0); // Reset to standing frame
                drawGame();
                return newStates;
            });
        };

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('keyup', handleKeyUp);
        };
    }, [drawGame, isInputActive, controlledCharacterIndex, isInitialized]);

    // Redraw the game when necessary
    useEffect(() => {
        if (!isInitialized) {
            console.debug("Skipping drawGame because not initialized");
            return;
        }
        drawGame();
    }, [drawGame, playerStates, animationFrame, isHoveredIndex, isInputActive, isInitialized]);


    // Function to check if a point is within a character's area
    const isPointInCharacter = (x: number, y: number, characterIndex: number): boolean => {
        const playerState = playerStates[characterIndex];
        if (!playerState) return false;

        const characterX = playerState.x * SCALE_FACTOR + MAP_OFFSET_X;
        const characterY = playerState.y * SCALE_FACTOR + MAP_OFFSET_Y;
        const characterWidth = SPRITE_SIZE * SCALE_FACTOR;
        const characterHeight = SPRITE_SIZE * SCALE_FACTOR;

        return (
            x >= characterX &&
            x <= characterX + characterWidth &&
            y >= characterY &&
            y <= characterY + characterHeight
        );
    };

    // Mouse move handler
    const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isInitialized || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let hoveredIndex: number | null = null;

        for (let i = 0; i < (charactersRef.current?.length || 0); i++) {
            if (isPointInCharacter(mouseX, mouseY, i)) {
                hoveredIndex = i;
                break;
            }
        }

        if (hoveredIndex !== isHoveredIndex) {
            setIsHoveredIndex(hoveredIndex);
        }
    };

    // Click handler to select character
    const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isInitialized || !canvasRef.current) return;

        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        let clickedCharacterIndex: number | null = null;

        for (let i = 0; i < (charactersRef.current?.length || 0); i++) {
            if (isPointInCharacter(mouseX, mouseY, i)) {
                clickedCharacterIndex = i;
                break;
            }
        }

        if (clickedCharacterIndex !== null) {
            if (controlledCharacterIndex !== clickedCharacterIndex) {
                // Close input field when selecting a new character
                setIsInputActive(false);
            }
            setControlledCharacterIndex(clickedCharacterIndex);
            // Remove AI state from the controlled character
            setPlayerStates((prevStates) => {
                const newStates = [...prevStates];
                delete newStates[clickedCharacterIndex].ai;
                return newStates;
            });
        } else {
            // Release control if clicked outside any character
            setControlledCharacterIndex(null);
            setIsInputActive(false);
        }
    };

    // Input key down handler for chat
    const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();

            if (inputValue.trim()) {
                // Add user message to notifications
                setNotifications(prev => [{
                    id: crypto.randomUUID(),
                    message: inputValue,
                    timestamp: new Date(),
                    characterName: 'You',
                    chatMode: chatMode,
                    metadata: null,
                }, ...prev].slice(0, 50));

                // Send message through God
                if (godRef.current) {
                    godRef.current.sendMessage(inputValue);
                } else {
                    console.error('God instance not initialized');
                }
            }

            // Reset input field
            setInputValue('');
            setIsInputActive(false);
        }
    };

    // Function to check if a position is walkable
    const isWalkable = useCallback((x: number, y: number): boolean => {
        // Adjust the check based on the scaled map
        const scaledX = (x - MAP_OFFSET_X) / SCALE_FACTOR;
        const scaledY = (y - MAP_OFFSET_Y) / SCALE_FACTOR;

        return WALKABLE_AREAS.some(
            (area) =>
                scaledX >= area.x &&
                scaledX < area.x + area.width &&
                scaledY >= area.y &&
                scaledY < area.y + area.height
        );
    }, []);

    // Compute controlled character's position for the input field
    const controlledPlayerState =
        controlledCharacterIndex !== null ? playerStates[controlledCharacterIndex] : null;
    const controlledCharacterX = controlledPlayerState
        ? controlledPlayerState.x * SCALE_FACTOR + MAP_OFFSET_X
        : 0;
    const controlledCharacterY = controlledPlayerState
        ? controlledPlayerState.y * SCALE_FACTOR + MAP_OFFSET_Y
        : 0;
    const characterWidth = SPRITE_SIZE * SCALE_FACTOR;

    // Function to send a message to all characters
    const handleGlobalMessage = (message: string) => {
        if (message.trim()) {
            setChatMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                message: message,
                timestamp: new Date(),
                chatMode: chatMode,
                characterName: 'You',
            }].slice(-50));

            // Send message through God
            if (godRef.current) {
                godRef.current.sendMessage(message);
            } else {
                console.error('God instance not initialized');
            }
        }
    };

    // Return statement with conditional rendering
    return (
        <div className="relative flex flex-col md:flex-row gap-4 h-[calc(100vh-5rem)] max-h-[calc(100vh-7rem)]">
            {/* Render CharacterSelect when isOpen is true */}
            {isOpen && <CharacterSelect />}

            {/* Left Column - RecursiveChat and Chat */}
            <div className="hidden md:flex md:flex-col w-80 h-full gap-4">
                <div className="h-auto">
                    <RecursiveChat chatMode={chatMode} setChatMode={setChatMode} />
                </div>
                <div className="flex-1 overflow-hidden rounded-lg shadow">
                    <Chat
                        messages={chatMessages}
                        onSendMessage={handleGlobalMessage}
                        disabled={!isInitialized}
                    />
                </div>
            </div>

            {/* Middle Column - Game Canvas */}
            <div className="relative flex-1 order-first md:order-none h-full flex items-center justify-center overflow-hidden rounded-lg shadow">
                {!isInitialized ? (
                    <div>Loading...</div>
                ) : (
                    <>
                        <canvas
                            ref={canvasRef}
                            width={CANVAS_WIDTH}
                            height={CANVAS_HEIGHT}
                            onMouseMove={handleMouseMove}
                            onClick={handleClick}
                            className="max-w-full max-h-full object-fill"
                            style={{
                                width: 'auto',
                                height: '100%'
                            }}
                        />
                        {isInputActive && controlledPlayerState && (
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleInputKeyDown}
                                style={{
                                    position: 'absolute',
                                    left: `${controlledCharacterX + characterWidth / 2}px`,
                                    top: `${controlledCharacterY - 30}px`,
                                    transform: 'translateX(-50%)',
                                    zIndex: 10,
                                }}
                                autoFocus
                            />
                        )}
                    </>
                )}
            </div>

            {/* Right Column - Notifications and Agent Details */}
            <div className="hidden md:block w-80 h-full space-y-4 shadow">
                <div className="h-[60%] overflow-hidden rounded-lg shadow">
                    <NotificationBoard notifications={notifications} />
                </div>
                <div className="h-[38%] overflow-hidden rounded-lg">
                    <AgentDetails
                        ens="agent.eth"
                        chain="Ethereum"
                        resources={["100 USDC", "2 NFTs", "1 Badge"]}
                    />
                </div>
            </div>

            {/* Mobile Chat and Notifications */}
            <div className="md:hidden fixed bottom-4 left-4 right-4 flex gap-2">
                <Chat
                    messages={chatMessages}
                    onSendMessage={handleGlobalMessage}
                    disabled={!isInitialized}
                />
                <NotificationBoard notifications={notifications} />
            </div>
        </div>
    );
};

export default Game;

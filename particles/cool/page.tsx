'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from "next/image";
// import { remove } from 'lodash';

export default function Home() {
  const canvasRef = useRef(null);
  const canvas2Ref = useRef(null);
  const [numPatricles, setNumParticles] = useState(0);
  const [particles, setParticles] = useState([]);
  const [resetGame, setResetGame] = useState(0); 

  const clamp = (value, min, max) => Math.max(Math.min(value, max), min);

  useEffect(() => {
    // Setup
    const canvas = canvasRef.current;
    const canvas2 = canvas2Ref.current;
    console.log('mount', canvas);
    const ctx = canvas.getContext('2d');
    const ctx2 = canvas2.getContext('2d');

    // Constants
    const gravity = 0.2;
    const cellSize = 10;
    const velocity = 5;

    // Game State
    let lastTick = performance.now();
    let lastRender = lastTick;
    let tickLength = 10; // tick frequency (50ms per tick = 20hz) 
    const grid = new Array(canvas.width * canvas.height).fill(0);
    
    /**
     * Helper functions
     */
    function createParticle(x, y) {
      return {
        x: x,
        y: y,
        dx: 0,
        dy: 0,
        color: `hsl(${360 * Math.random()}, 
                ${clamp(100 * Math.random(), 60, 70)}%, 
                ${clamp(100 * Math.random(), 50, 55)}%)`, 
      };
    }

    function drawParticle(particle) {
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, cellSize, cellSize);
    }

    /**
     * Update state and draw
     */
    function queueUpdates(numTicks) {
      for (let i = 0; i < numTicks; i++) {
        lastTick += tickLength; // Now lastTick is this tick.
        updateParticles(lastTick);
      }
    }

    function updateParticles(lastTick) {
      for (let particle of particles) {
        const getSign = () => Math.random() > 0.5 ? -1 : 1; 
        if (!particle.dx) {
          // Choose a random direction and speed for each particle's movement
          // Store the movement in the particle so they continue to move in that direction on each update
          particle.dx = clamp(Math.random() * velocity, 0, 10) * getSign();
          particle.dy = clamp(Math.random() * velocity, 0, 10) * getSign();
        }
        
        // Detect wall collision
        //  Canvas:
        // {
        //   "x": 69.5,
        //   "y": 48,
        //   "width": 802,
        //   "height": 602,
        //   "top": 48,
        //   "right": 871.5,
        //   "bottom": 650,
        //   "left": 69.5
        // }
        if (particle.x + particle.dx > canvas.width - cellSize || particle.x + particle.dx < cellSize) {
          // console.log('hit right/left'); 
          particle.dx = -particle.dx;
        }
        if (particle.y + particle.dy > canvas.height - cellSize || particle.y + particle.dy < cellSize) {
          // console.log('hit top/bottom');
          particle.dy = -particle.dy;
        }

        particle.x += particle.dx;
        particle.y += particle.dy;
      }
    }
    let drawsOnSecondCanvas = 0;
    function draw(tFrame) {
      // const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // console.log('imageData', imageData);
      // console.log(tFrame)


      
      // Captures image data from the canvas. Can be passed to a new canvas to create an image. Can also use .toDataUrl() to get some base64 image data. Can maybe use this to create background image that updates every 1000ms or so.

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // ctx2.clearRect(0, 0, canvas2.width, canvas2.height);

      
      for (let particle of particles) {
        if (Math.floor(tFrame) % 39 === 0) {
          ctx2.drawImage(canvas, 0,0);
          drawsOnSecondCanvas++;
        }
        drawParticle(particle);
      }
      // console.log('drawsOnSecondCanvas', drawsOnSecondCanvas);
      console.log('second canvas draws every ', Math.floor(tFrame) / drawsOnSecondCanvas, ' frames');
      setNumParticles(particles.length);
    }

    /**
     * Game loop
     */
    function gameLoop(tFrame) {
      const stopMain = requestAnimationFrame(gameLoop);
      const nextTick = lastTick + tickLength;  
      let numTicks = 0;

      // If numTicks is large, then either your game was asleep, or the machine cannot keep up.
      if (tFrame > nextTick) {
        const timeSinceTick = tFrame - lastTick;
        numTicks = Math.floor(timeSinceTick / tickLength);
      }

      queueUpdates(numTicks);
      draw(tFrame);
      lastRender = tFrame;
    }

    /**
     * Event handlers
     */
    const createParticleOnMouseLocation = (e) => {
      const x = e.clientX - canvas.getBoundingClientRect().left;
      const y = e.clientY - canvas.getBoundingClientRect().top; 
      const newParticle = createParticle(x, y);
      particles.push(newParticle);
    }

    canvas.addEventListener('mousedown', (e) => {
      createParticleOnMouseLocation(e);
      canvas.addEventListener('mousemove', createParticleOnMouseLocation);
    });

    canvas.addEventListener('mouseup', function() {
      console.log('onmouseup', canvas);
      canvas.removeEventListener('mousemove', createParticleOnMouseLocation);
    });

    canvas.addEventListener('mouseleave', (e) => {
      canvas.removeEventListener('mousemove', createParticleOnMouseLocation);
    });

    gameLoop(performance.now());  // Start the game loop


    return() => {
      console.log('unmount');
      canvas.removeEventListener('mousedown', createParticleOnMouseLocation);
      canvas.removeEventListener('mouseup', createParticleOnMouseLocation);
      canvas.removeEventListener('mousemove', createParticleOnMouseLocation);
      canvas.removeEventListener('mouseleave', (e) => {});
    };
  }, [canvasRef, resetGame]);



  return (
    <div className="overflow-hidden bg-dark">
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-indigo-900 sm:text-4xl">Particles</h2>
      <p>Number of Particles: {numPatricles}</p>
      <button type="submit" className="rounded-md bg-indigo-600 px-3 py-2 font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
      onClick={() => {
        // let imageData = canvasRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        // console.log('imageData', imageData);
        setParticles([]);
        setResetGame(prev => prev + 1);
        }}
      >
        Reset
      </button> 

      <canvas ref={canvasRef} style={{backgroundColor: '#000', outline: '1px solid red'}} id="gameCanvas" width="640" height="300"></canvas>
      <canvas ref={canvas2Ref} style={{backgroundColor: '#000', outline: '1px solid red'}} id="gameCanvas2" width="640" height="300"></canvas>
    </div>
  );
}
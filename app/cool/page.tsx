'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from "next/image";
import { remove } from 'lodash';

export default function Home() {
  const canvasRef = useRef(null);
  const [numPatricles, setNumParticles] = useState(0);

  const clamp = (value, min, max) => Math.max(Math.min(value, max), min);

  useEffect(() => {
    // Setup
    const canvas = canvasRef.current;
    console.log('mount', canvas);
    const ctx = canvas.getContext('2d');

    // Constants
    const gravity = 0.2;
    const cellSize = 10;
    const width = canvas.width;
    const height = canvas.height;

    // Game State
    let lastTick = performance.now();
    let lastRender = lastTick;
    let tickLength = 10; // tick frequency (50ms per tick = 20hz) 
    const particles = [];
    const grid = new Array(width * height).fill(0);
    
    /**
     * Helper functions
     */
    function createParticle(x, y) {
      return {
        x: x,
        y: y,
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
      const particlesSet = new Set(particles);
      console.log('update', particlesSet);
      let sign = 1;
        
      for (let particle of particles) {
        sign = Math.random() > 0.5 ? -1 : 1;
        let dx = 10 * sign;
        sign = Math.random() > 0.5 ? -1 : 1; 
        let dy = 10 * sign;
        // console.log('update', particle);
        // console.log('n:',particles.length);
        // console.log(particle.y, height);

        // Detect wall collision
        if (particle.x + dx > canvas.width - cellSize || particle.x + dx < cellSize) {
          dx = -dx;
        }
        if (particle.y + dy > height - cellSize || particle.y + dy < cellSize) {
          dy = -dy;
        }

        // particle.y += gravity + Math.random();
        particle.x += dx;
        particle.y += dy;
      }
    }

    function draw(tFrame) {
      ctx.clearRect(0, 0, width, height);
      for (let particle of particles) {
        drawParticle(particle);
      }
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

      // console.log('gameLoop', requestAnimationFrame(gameLoop));

      queueUpdates(numTicks);
      draw(tFrame);
      lastRender = tFrame;
    }

    /**
     * Event handlers
     */
    const createParticleOnMouseLocation = (e) => {
      const canvasBounds = canvas.getBoundingClientRect();
      const x = e.clientX - canvas.getBoundingClientRect().left;
      const y = e.clientY - canvas.getBoundingClientRect().top;
      console.log(x, y);
      console.log(canvasBounds);

      particles.push(createParticle(x, y));
      console.log(particles);
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
  }, [canvasRef]);



  return (
    <div>
      <h2>Particles</h2>
      <p>Number of Particles: {numPatricles}</p>
      <canvas ref={canvasRef} id="gameCanvas" width="800" height="600"></canvas>
    </div>
  );
}
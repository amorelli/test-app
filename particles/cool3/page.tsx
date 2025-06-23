'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from "next/image";
import { remove } from 'lodash';

export default function Home() {
  const canvasRef = useRef(null);
  const [numPatricles, setNumParticles] = useState(0);

  const clamp = (value, min, max) => Math.max(Math.min(value, max), min);

  const make2dArray = (cols, rows) => {
    const arr = new Array(cols);
    for (let i = 0; i < arr.length; i++) {
        arr[i] = new Array(rows);
    }
    return arr;
  }

  useEffect(() => {
    // Setup
    const canvas = canvasRef.current;
    console.log('mount', canvas);
    const ctx = canvas.getContext('2d');

    // Constants
    const gravity = 0.2;
    const cellSize = 10;
    const velocity = 5;

    // Game State
    let lastTick = performance.now();
    let lastRender = lastTick;
    let tickLength = 10; // tick frequency (50ms per tick = 20hz) 

    // const grid = new Array(canvas.width * canvas.height).fill(0);
    
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
      const particlesSet = new Set(particles);
      // console.log('update', particlesSet);

      // Choose a random direction for each particle
      
      // let dx = 10 * getSign();
      // let dy = 10 * getSign();
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
          // particle.dx = 0;
        }
        if (particle.y + particle.dy > canvas.height - cellSize || particle.y + particle.dy < cellSize) {
          // console.log('hit top/bottom');
          particle.dy = -particle.dy;
          // particle.dy = 0;
        }

        // particle.y += gravity + Math.random();
        particle.x += particle.dx;
        particle.y += particle.dy;

        // console.log(particle.dx, particle.dy);
      }
    }

    function draw(tFrame) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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

      // let sign = 1;
      const getSign = () => Math.random() > 0.5 ? -1 : 1;   
        // let dx = 10 * sign;
        // sign = Math.random() > 0.5 ? -1 : 1; 
        // let dy = 10 * sign;
      const newParticle = createParticle(x, y);
      console.log('create particle', newParticle);
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
  }, [canvasRef]);



  return (
    <div>
      <h2>Particles</h2>
      <p>Number of Particles: {numPatricles}</p>
      <canvas ref={canvasRef} id="gameCanvas" width="640" height="480"></canvas>
    </div>
  );
}
# Tetris Game

A responsive browser-based Tetris game built with HTML, CSS, and JavaScript.

## Features

- Classic seven tetromino pieces
- Canvas-based 10x20 game board
- Next-piece preview
- Score, lines, level, and best-score panels
- Best score saved with `localStorage`
- Increasing speed as levels rise
- Animated line clears with particles
- Collision shake feedback
- Safer pause, restart, and game-over state handling
- Ghost piece toggle
- Sound toggle
- Pause and restart controls
- Keyboard controls for desktop
- Touch controls for mobile

## Tech Stack

- HTML
- CSS
- JavaScript

## Run Locally

Open `index.html` directly in a browser, or run a local server:

```bash
python -m http.server 8020
```

Then open:

```text
http://127.0.0.1:8020/
```

## Controls

- Move left: `ArrowLeft` or `A`
- Move right: `ArrowRight` or `D`
- Soft drop: `ArrowDown` or `S`
- Rotate: `ArrowUp` or `W`
- Hard drop: `Space`
- Pause: `P`

## Project Structure

```text
Tetris_Game/
|-- index.html
|-- style.css
|-- app.js
|-- README.md
`-- .gitignore
```

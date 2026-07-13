Photobooth — static web app

This is a small, mobile-friendly photobooth web app that captures camera frames from a phone or laptop and assembles them into a grid (e.g. 4x2). It's implemented as a plain static site (HTML/CSS/JS) so it can be hosted via GitHub Pages.

Files included:
- index.html — main page
- style.css — styling
- app.js — JavaScript logic

How to publish on GitHub (quick):
1. Create a new repository on GitHub (e.g., photobooth).
2. On your machine, in this folder run:

   git init
   git add .
   git commit -m "Add photobooth static site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main

3. In the repository on GitHub: Settings -> Pages -> Build and deployment -> Deploy from a branch. Choose branch: main (root) and Save.
4. After a minute your site will be available at https://<your-username>.github.io/<your-repo>/ — open that URL on your phone and allow camera access.

Notes and tips:
- On phones, choose the rear camera by allowing camera access and (if prompted) selecting the rear camera. The app tries to prefer the environment facing camera.
- Use the layout selector to pick a grid (e.g., 4x2). Set cell size for final image resolution.
- Capture manually or use Auto Capture (3s interval) to fill the grid automatically.
- When the grid fills, press "Assemble" and then Download.

Security / Browser notes:
- Serve over HTTPS (GitHub Pages provides HTTPS) otherwise getUserMedia may be blocked.
- Modern mobile browsers (Chrome, Safari) are required. Desktop browsers can also work but camera selection may differ.

Customization ideas:
- Add countdown visuals per capture, animation, filters, or stickers.
- Support multi-shot bursts and GIF creation.
- Add server-side upload or print integration.

If you'd like, I can:
- Add countdown and shutter sound
- Add borders, background colors, and print-ready layout
- Package this into a ready-to-push git repo and create the GitHub repository for you (I will need your confirmation and a repository name)

Enjoy!

const introVideo = document.getElementById('intro-video');
const introVideos = ['intro1.mp4', 'intro2.mp4', 'intro3.mp4'];
let currentVideoIndex = 0;

introVideo.addEventListener('ended', () => {
    currentVideoIndex = (currentVideoIndex + 1) % introVideos.length;
    const videoSource = introVideo.querySelector('source');

    videoSource.setAttribute('src', `assets/videos/${introVideos[currentVideoIndex]}`);
    introVideo.load();
    introVideo.play().catch(() => {});
});


import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import YouTube from 'react-youtube';
import { Search, Play, Users, Copy, Check } from 'lucide-react';

export default function App() {
  const [roomCode, setRoomCode] = useState('');
  const [inRoom, setInRoom] = useState(false);
  const [videoCode, setVideoCode] = useState('');
  const [youtubeKey, setYoutubeKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [copied, setCopied] = useState(false);

  const playerRef = useRef(null);
  const isRemoteSyncing = useRef(false);

  const handleJoinRoom = async () => {
    if (!roomCode) return;
    const roomRef = doc(db, 'rooms', roomCode);
    setInRoom(true);

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        if (playerRef.current) {
          const player = playerRef.current;
          const currentTime = player.getCurrentTime() || 0;
          
          if (data.videoId && data.videoId !== videoCode) {
            setVideoCode(data.videoId);
          }

          const timeDiff = Math.abs(currentTime - data.timestamp);
          
          // Only seek if we are out of sync by more than 2 seconds
          if (timeDiff > 2 && data.state === 'playing') {
            isRemoteSyncing.current = true;
            const latency = (Date.now() - data.lastUpdated) / 1000;
            player.seekTo(data.timestamp + latency, true);
          }

          if (data.state === 'playing' && player.getPlayerState() !== 1) {
            isRemoteSyncing.current = true;
            player.playVideo();
          } else if (data.state === 'paused' && player.getPlayerState() !== 2) {
            isRemoteSyncing.current = true;
            player.pauseVideo();
          }
        }
      } else {
        setDoc(roomRef, {
          videoId: '',
          state: 'paused',
          timestamp: 0,
          lastUpdated: Date.now()
        });
      }
    });

    return () => unsubscribe();
  };

  const updateRoomState = async (state, timestamp, videoId = videoCode) => {
    if (isRemoteSyncing.current) {
      isRemoteSyncing.current = false;
      return;
    }
    const roomRef = doc(db, 'rooms', roomCode);
    await updateDoc(roomRef, {
      state,
      timestamp,
      videoId,
      lastUpdated: Date.now()
    });
  };

  const onPlayerStateChange = (event) => {
    if (event.data === 1) { // Playing
      updateRoomState('playing', event.target.getCurrentTime());
    } else if (event.data === 2) { // Paused
      updateRoomState('paused', event.target.getCurrentTime());
    }
  };

  const searchYouTube = async (e) => {
    e.preventDefault();
    if (!youtubeKey || !searchQuery) return alert("Enter API Key and search term");
    
    try {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=10&q=${encodeURIComponent(searchQuery)}&type=video&key=${youtubeKey}`);
      const data = await res.json();
      if (data.items) setSearchResults(data.items);
    } catch (err) {
      alert("Error searching YouTube.");
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inRoom) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-gray-900 p-8 rounded-xl shadow-2xl w-full max-w-md border border-gray-800">
          <div className="flex justify-center mb-6"><Users size={48} className="text-blue-500" /></div>
          <h1 className="text-3xl font-bold text-center mb-6">SyncTube</h1>
          <div className="space-y-4">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="ENTER ROOM CODE (e.g. PARTY)"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 uppercase"
            />
            <button onClick={handleJoinRoom} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors">
              Join / Create Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Users className="text-blue-500" />
            <span className="font-semibold">Room: {roomCode}</span>
            <button onClick={copyRoomCode} className="text-gray-400 hover:text-white transition-colors">
              {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
            </button>
          </div>
          <button onClick={() => setInRoom(false)} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm">
            Leave Room
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <div className="bg-black aspect-video rounded-xl overflow-hidden border border-gray-800 flex items-center justify-center w-full">
              {videoCode ? (
                <YouTube
                  videoId={videoCode}
                  opts={{ width: '100%', height: '100%', playerVars: { autoplay: 1, modestbranding: 1 } }}
                  onReady={(e) => { playerRef.current = e.target; }}
                  onStateChange={onPlayerStateChange}
                  className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full"
                />
              ) : (
                <div className="text-gray-500 flex flex-col items-center"><Play size={48} className="mb-2 opacity-50" /><p>Search a video to sync</p></div>
              )}
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 h-[500px] flex flex-col">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Search size={18} /> Search YouTube</h2>
            <form onSubmit={searchYouTube} className="space-y-2 mb-4">
              <input type="password" placeholder="YouTube API Key" value={youtubeKey} onChange={(e) => setYoutubeKey(e.target.value)} className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2">
                <input type="text" placeholder="Song or Artist..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg"><Search size={18} /></button>
              </div>
            </form>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {searchResults.map((video) => (
                <div key={video.id.videoId} onClick={() => { setVideoCode(video.id.videoId); updateRoomState('playing', 0, video.id.videoId); }} className="flex gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-pointer group">
                  <img src={video.snippet.thumbnails.default.url} alt="thumbnail" className="w-20 h-14 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate group-hover:text-blue-400">{video.snippet.title}</p>
                    <p className="text-xs text-gray-500 truncate">{video.snippet.channelTitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

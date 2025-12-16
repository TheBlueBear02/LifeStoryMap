import { Routes, Route } from 'react-router-dom'
import './App.css'
import HomeView from './views/HomeView.jsx'
import EditStoryView from './views/EditStoryView.jsx'

function App() {
  return (
    <div className="app-container">
      <div className="app-root">
        <Routes>
          <Route path="/" element={<HomeView />} />
          <Route path="/edit-story/:storyId" element={<EditStoryView />} />
          <Route path="/create-story" element={<EditStoryView />} />
        </Routes>
      </div>
    </div>
  )
}

export default App

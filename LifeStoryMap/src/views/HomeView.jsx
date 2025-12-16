import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function HomeView() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [newStoryName, setNewStoryName] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const loadStories = async () => {
      try {
        const res = await fetch('/api/stories')
        if (!res.ok) throw new Error('Failed to load stories')
        const data = await res.json()
        setStories(Array.isArray(data) ? data : [])
      } catch (err) {
        console.error(err)
        setStories([])
      } finally {
        setLoading(false)
      }
    }
    loadStories()
  }, [])

  const handleCreateStory = async (e) => {
    e.preventDefault()
    if (!newStoryName.trim()) return

    try {
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStoryName.trim() }),
      })
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to create story')
        return
      }
      const newStory = await res.json()
      setStories([...stories, newStory])
      setNewStoryName('')
      setSelectedSlot(null)
      navigate(`/edit-story/${newStory.id}`)
    } catch (err) {
      console.error(err)
      alert('Failed to create story')
    }
  }

  const MAX_STORIES = 4
  const unusedSlots = Array.from({ length: MAX_STORIES - stories.length }, (_, i) => stories.length + i + 1)

  const handleDeleteStory = async (storyId) => {
    if (!window.confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return
    }

    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to delete story')
        return
      }
      setStories(stories.filter((s) => s.id !== storyId))
    } catch (err) {
      console.error(err)
      alert('Failed to delete story')
    }
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateString
    }
  }

  return (
    <div className="home-view">
      <div className="home-content">
        <h1>Life Story Maps</h1>
        <p className="home-subtitle">Create and manage your life story maps</p>

        {loading ? (
          <div className="stories-loading">Loading stories...</div>
        ) : (
          <>
            <div className="stories-list">
              {stories.length === 0 ? (
                <div className="empty-stories">
                  <p>No stories yet. Create your first story to get started!</p>
                </div>
              ) : (
                stories.map((story) => (
                  <div key={story.id} className="story-card">
                    <div className="story-card-header">
                      <h3 className="story-name">{story.name}</h3>
                      <div className="story-header-actions">
                        <button
                          type="button"
                          className="story-delete-btn"
                          onClick={() => handleDeleteStory(story.id)}
                        >
                          Remove
                        </button>
                        <div className="story-badge">
                          {story.published ? (
                            <span className="badge published">Published</span>
                          ) : (
                            <span className="badge draft">Draft</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="story-card-info">
                      <div className="story-info-item">
                        <span className="info-label">Events:</span>
                        <span className="info-value">{story.eventCount}</span>
                      </div>
                      <div className="story-info-item">
                        <span className="info-label">Created:</span>
                        <span className="info-value">{formatDate(story.dateCreated)}</span>
                      </div>
                    </div>
                    <div className="story-card-actions">
                      <Link
                        to={`/view-story/${story.id}`}
                        className="primary-btn story-view-btn"
                      >
                        View
                      </Link>
                      <Link
                        to={`/edit-story/${story.id}`}
                        className="secondary-btn story-edit-btn"
                      >
                        Edit Story
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            {!selectedSlot && unusedSlots.length > 0 && (
              <div className="create-story-btn-wrapper">
                <div className="story-slots-container">
                  {unusedSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className="between-plus-btn"
                      onClick={() => setSelectedSlot(slot)}
                    >
                      + Create Story {slot}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedSlot && (
              <form className="create-story-form" onSubmit={handleCreateStory}>
                <input
                  type="text"
                  className="story-name-input"
                  placeholder={`Enter name for Story ${selectedSlot}`}
                  value={newStoryName}
                  onChange={(e) => setNewStoryName(e.target.value)}
                  autoFocus
                />
                <div className="create-story-form-actions">
                  <button type="submit" className="primary-btn" disabled={!newStoryName.trim()}>
                    Create Story {selectedSlot}
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setSelectedSlot(null)
                      setNewStoryName('')
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {stories.length >= MAX_STORIES && (
              <p className="max-stories-message">Maximum of {MAX_STORIES} stories reached</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default HomeView

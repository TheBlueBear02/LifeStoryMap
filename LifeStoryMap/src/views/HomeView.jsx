import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoImage from '../assets/Logos/logo no name no bg.png'
import { getStories, createStory, updateStory, deleteStory } from '../services/storyService.js'
import { ROUTES } from '../constants/paths.js'

function HomeView() {
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [newStoryName, setNewStoryName] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [editingStoryId, setEditingStoryId] = useState(null)
  const [editingStoryName, setEditingStoryName] = useState('')
  const menuRefs = useRef({})
  const navigate = useNavigate()

  useEffect(() => {
    const loadStories = async () => {
      try {
        const data = await getStories()
        setStories(data)
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
      const newStory = await createStory(newStoryName.trim())
      setStories([...stories, newStory])
      setNewStoryName('')
      setSelectedSlot(null)
      navigate(ROUTES.EDIT_STORY(newStory.id))
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to create story')
    }
  }

  const MAX_STORIES = 4
  const unusedSlots = Array.from({ length: MAX_STORIES - stories.length }, (_, i) => stories.length + i + 1)

  const handleDeleteStory = async (storyId) => {
    if (!window.confirm('Are you sure you want to delete this story? This action cannot be undone.')) {
      return
    }

    try {
      await deleteStory(storyId)
      setStories(stories.filter((s) => s.id !== storyId))
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to delete story')
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openMenuId && menuRefs.current[openMenuId]) {
        if (!menuRefs.current[openMenuId].contains(event.target)) {
          setOpenMenuId(null)
        }
      }
    }

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMenuId])

  const toggleMenu = (storyId) => {
    setOpenMenuId(openMenuId === storyId ? null : storyId)
  }

  const handleStartEditTitle = (storyId, currentName) => {
    setEditingStoryId(storyId)
    setEditingStoryName(currentName)
  }

  const handleCancelEditTitle = () => {
    setEditingStoryId(null)
    setEditingStoryName('')
  }

  const handleSaveTitle = async (storyId) => {
    if (!editingStoryName.trim()) {
      handleCancelEditTitle()
      return
    }

    try {
      const updatedStory = await updateStory(storyId, { name: editingStoryName.trim() })
      setStories(stories.map((s) => (s.id === storyId ? updatedStory : s)))
      setEditingStoryId(null)
      setEditingStoryName('')
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to update story name')
    }
  }

  const handleTitleKeyDown = (e, storyId) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveTitle(storyId)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEditTitle()
    }
  }

  return (
    <div className="home-view">
      <div className="home-content">
        <div className="home-logo-container" style={{ display: "flex", justifyContent: "center"}}>
          <img
            src={logoImage}
            alt="Life Story Map Logo"
            className="home-logo"
            style={{ width: 320, height: "auto" }}
          />
        </div>
        <h1>KAMINO</h1>
        <div className="home-title-separator"></div>
        <p className="home-subtitle">YOUR DIGITAL FAMILY STORY</p>

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
                      <div className="story-name-container">
                        {editingStoryId === story.id ? (
                          <input
                            type="text"
                            className="story-name-input-edit"
                            value={editingStoryName}
                            onChange={(e) => setEditingStoryName(e.target.value)}
                            onBlur={() => handleSaveTitle(story.id)}
                            onKeyDown={(e) => handleTitleKeyDown(e, story.id)}
                            autoFocus
                          />
                        ) : (
                          <>
                            <h3 
                              className="story-name"
                              onClick={() => handleStartEditTitle(story.id, story.name)}
                              title="Click to edit"
                            >
                              {story.name}
                            </h3>
                            <button
                              type="button"
                              className="story-name-edit-icon"
                              onClick={() => handleStartEditTitle(story.id, story.name)}
                              aria-label="Edit story name"
                            >
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M11.333 2.00001C11.5084 1.82465 11.7163 1.68571 11.9447 1.59189C12.1731 1.49807 12.4173 1.45142 12.6637 1.45468C12.91 1.45795 13.1532 1.51106 13.3788 1.61081C13.6044 1.71056 13.8078 1.85473 13.9773 2.03534C14.1468 2.21595 14.2789 2.42937 14.3659 2.66299C14.4529 2.89661 14.4929 3.14574 14.4833 3.39501C14.4737 3.64428 14.4147 3.88889 14.3101 4.11445C14.2055 4.34001 14.0576 4.54211 13.8753 4.70834L13.333 5.25001L10.75 2.66668L11.2913 2.12534L11.333 2.00001ZM9.66667 3.66668L12.25 6.25001L5.58333 12.9167H3V10.3333L9.66667 3.66668Z" fill="currentColor"/>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                      <div className="story-header-actions">
                        <div className="story-badge">
                          {story.published ? (
                            <span className="badge published">Published</span>
                          ) : (
                            <span className="badge draft">Draft</span>
                          )}
                        </div>
                        <div className="story-menu-container" ref={(el) => (menuRefs.current[story.id] = el)}>
                          <button
                            type="button"
                            className="story-menu-icon"
                            onClick={() => toggleMenu(story.id)}
                            aria-label="Story menu"
                          >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="10" cy="4" r="1.5" fill="currentColor"/>
                              <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
                              <circle cx="10" cy="16" r="1.5" fill="currentColor"/>
                            </svg>
                          </button>
                          {openMenuId === story.id && (
                            <div className="story-menu-dropdown">
                              <button
                                type="button"
                                className="story-menu-item"
                                onClick={() => {
                                  handleDeleteStory(story.id)
                                  setOpenMenuId(null)
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="story-card-actions">
                      <Link
                        to={ROUTES.VIEW_STORY(story.id)}
                        className="primary-btn story-view-btn"
                      >
                        View
                      </Link>
                      <Link
                        to={ROUTES.EDIT_STORY(story.id)}
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

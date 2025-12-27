import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import logoImage from '../assets/Logos/logo no name no bg.png'
import { getStories, createStory, updateStory, deleteStory } from '../services/storyService.js'
import { ROUTES, API_PATHS } from '../constants/paths.js'
import { get } from '../services/api.js'
import { generateAudio } from '../services/audioService.js'
import { getEvents } from '../services/eventService.js'

function HomeView() {
  const [stories, setStories] = useState([])
  const [exampleStories, setExampleStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [newStoryName, setNewStoryName] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [editingStoryId, setEditingStoryId] = useState(null)
  const [editingStoryName, setEditingStoryName] = useState('')
  const [presentationType, setPresentationType] = useState({}) // { storyId: 'Presentation' | 'Cinema' }
  const [generatingAudio, setGeneratingAudio] = useState({}) // { storyId: true/false }
  const [eventsData, setEventsData] = useState({}) // { storyId: events[] } - stores events for each story
  const menuRefs = useRef({})
  const navigate = useNavigate()

  // Helper function to strip HTML and get plain text
  const stripHtml = (html) => {
    if (!html) return ''
    let text = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
    text = text.replace(/<[^>]*>/g, '')
    text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    text = text.replace(/&#x([a-f\d]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    return text.replace(/\s+/g, ' ').trim()
  }

  // Check if a story needs audio generation
  const needsAudioGeneration = (storyId) => {
    const events = eventsData[storyId]
    if (!Array.isArray(events)) return false

    // Find the story to get its language
    const story = [...stories, ...exampleStories].find((s) => s.id === storyId)
    const storyLanguage = story?.language || 'en'
    
    // Default texts for different languages
    const defaultTexts = {
      'he': 'טקסט מלא על האירוע',
      'en': 'Full text about the event',
    }
    const defaultText = defaultTexts[storyLanguage] || defaultTexts['en']
    
    // Check if there are any events that need audio
    return events.some((event) => {
      // Skip Opening and Closing events
      if (event?.eventType === 'Opening' || event?.eventType === 'Closing') {
        return false
      }

      const textHtml = event?.content?.textHtml || ''
      const plainText = stripHtml(textHtml)
      const trimmedText = plainText.trim()

      // Event needs audio if it has text, not default text, and no audioUrl
      return trimmedText && trimmedText !== defaultText && !event?.content?.audioUrl
    })
  }

  // Load events for a story
  const loadEventsForStory = async (storyId) => {
    if (eventsData[storyId]) return // Already loaded
    
    try {
      const events = await getEvents(storyId)
      setEventsData((prev) => ({ ...prev, [storyId]: events }))
    } catch (err) {
      console.error(`Error loading events for story ${storyId}:`, err)
      setEventsData((prev) => ({ ...prev, [storyId]: [] }))
    }
  }

  useEffect(() => {
    const loadStories = async () => {
      try {
        console.log('Loading stories from:', API_PATHS.STORIES)
        const [data, examples] = await Promise.all([
          getStories(),
          get(API_PATHS.EXAMPLE_STORIES).catch(() => []),
        ])
        console.log('Stories loaded:', data)
        console.log('Example stories loaded:', examples)
        const exampleStoriesArray = Array.isArray(examples) ? examples : []
        const storiesArray = Array.isArray(data) ? data : []
        setStories(storiesArray)
        setExampleStories(exampleStoriesArray)
        
        // Initialize presentation type for all stories (regular + examples)
        const initialPresentationType = {}
        storiesArray.forEach((story) => {
          initialPresentationType[story.id] = 'Presentation'
        })
        exampleStoriesArray.forEach((story) => {
          initialPresentationType[story.id] = 'Presentation'
        })
        setPresentationType(initialPresentationType)

        // Load events for all stories to check audio status
        const allStoryIds = [...storiesArray, ...exampleStoriesArray].map(s => s.id)
        allStoryIds.forEach(storyId => {
          loadEventsForStory(storyId)
        })
      } catch (err) {
        console.error('Error loading stories:', err)
        console.error('Error details:', err.message, err.stack)
        setStories([])
        setExampleStories([])
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

  const handlePresentationTypeToggle = (storyId) => {
    setPresentationType((prev) => {
      const newType = prev[storyId] === 'Presentation' ? 'Cinema' : 'Presentation'
      // Load events when switching to Cinema view to check audio status
      if (newType === 'Cinema') {
        loadEventsForStory(storyId)
      }
      return {
        ...prev,
        [storyId]: newType,
      }
    })
  }

  const handleGenerateAudio = async (storyId) => {
    if (generatingAudio[storyId]) return // Prevent multiple clicks

    setGeneratingAudio((prev) => ({ ...prev, [storyId]: true }))
    
    try {
      const result = await generateAudio(storyId)
      
      // Check if there were errors
      if (result.errors && result.errors.length > 0) {
        const errorCount = result.errors.length
        const successCount = result.generated || 0
        if (successCount > 0) {
          alert(
            `Partially completed: Generated audio for ${successCount} event(s), but ${errorCount} event(s) failed.\n\n` +
            `First error: ${result.errors[0].message}`
          )
        } else {
          alert(
            `Failed to generate audio for ${errorCount} event(s).\n\n` +
            `Error: ${result.errors[0].message}`
          )
        }
      } else if (result.generated > 0) {
        alert(`Successfully generated audio for ${result.generated} event(s)!`)
      } else {
        alert('No audio files were generated. All events may already have audio or no events need audio generation.')
      }
      
      // Reload events to get updated audio URLs
      const events = await getEvents(storyId)
      setEventsData((prev) => ({ ...prev, [storyId]: events }))
    } catch (err) {
      console.error('Error generating audio:', err)
      // Show the error message from the API
      const errorMessage = err.message || 'Failed to generate audio. Please try again.'
      alert(`Error: ${errorMessage}`)
    } finally {
      setGeneratingAudio((prev) => ({ ...prev, [storyId]: false }))
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
                    <div className="story-card-presentation-toggle">
                      <div className="presentation-type-toggle">
                        <button
                          type="button"
                          className={`toggle-btn ${(presentationType[story.id] || 'Presentation') === 'Presentation' ? 'active' : ''}`}
                          onClick={() => handlePresentationTypeToggle(story.id)}
                        >
                          <span className="toggle-icon">🎬</span> Presentation
                        </button>
                        <button
                          type="button"
                          className={`toggle-btn ${(presentationType[story.id] || 'Presentation') === 'Cinema' ? 'active' : ''}`}
                          onClick={() => handlePresentationTypeToggle(story.id)}
                        >
                          <span className="toggle-icon">📽️</span> Cinema
                        </button>
                      </div>
                    </div>
                    <div className="story-card-actions">
                      {(presentationType[story.id] || 'Presentation') === 'Cinema' ? (
                        needsAudioGeneration(story.id) ? (
                          <button
                            type="button"
                            onClick={() => handleGenerateAudio(story.id)}
                            className="primary-btn story-view-btn"
                            disabled={generatingAudio[story.id]}
                          >
                            {generatingAudio[story.id] ? 'Generating...' : 'Generate Audio'}
                          </button>
                        ) : (
                          <Link
                            to={ROUTES.CINEMA_STORY(story.id)}
                            className="primary-btn story-view-btn"
                          >
                            View
                          </Link>
                        )
                      ) : (
                        <Link
                          to={ROUTES.VIEW_STORY(story.id)}
                          className="primary-btn story-view-btn"
                        >
                          View
                        </Link>
                      )}
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

            {Array.isArray(exampleStories) && exampleStories.length > 0 && (
              <details className="examples-folder" style={{ marginTop: '1.25rem' }}>
                <summary className="examples-folder-summary">
                  <span className="examples-folder-title">Example Stories</span>
                  <span className="examples-folder-count">{exampleStories.length}</span>
                </summary>
                <div className="examples-folder-content stories-list">
                  {exampleStories.map((story) => (
                    <div key={story.id} className="story-card">
                      <div className="story-card-header">
                        <div className="story-name-container">
                          <h3 className="story-name">{story.name}</h3>
                        </div>
                        <div className="story-header-actions">
                          <div className="story-badge">
                            <span className="badge draft">Example</span>
                          </div>
                        </div>
                      </div>
                      <div className="story-card-presentation-toggle">
                        <div className="presentation-type-toggle">
                          <button
                            type="button"
                            className={`toggle-btn ${(presentationType[story.id] || 'Presentation') === 'Presentation' ? 'active' : ''}`}
                            onClick={() => handlePresentationTypeToggle(story.id)}
                          >
                            <span className="toggle-icon">🎬</span> Presentation
                          </button>
                          <button
                            type="button"
                            className={`toggle-btn ${(presentationType[story.id] || 'Presentation') === 'Cinema' ? 'active' : ''}`}
                            onClick={() => handlePresentationTypeToggle(story.id)}
                          >
                            <span className="toggle-icon">📽️</span> Cinema
                          </button>
                        </div>
                      </div>
                      <div className="story-card-actions">
                        {(presentationType[story.id] || 'Presentation') === 'Cinema' ? (
                          needsAudioGeneration(story.id) ? (
                            <button
                              type="button"
                              onClick={() => handleGenerateAudio(story.id)}
                              className="primary-btn story-view-btn"
                              disabled={generatingAudio[story.id]}
                            >
                              {generatingAudio[story.id] ? 'Generating...' : 'Generate Audio'}
                            </button>
                          ) : (
                            <Link
                              to={ROUTES.CINEMA_STORY(story.id)}
                              className="primary-btn story-view-btn"
                            >
                              View
                            </Link>
                          )
                        ) : (
                          <Link
                            to={ROUTES.VIEW_STORY(story.id)}
                            className="primary-btn story-view-btn"
                          >
                            View
                          </Link>
                        )}
                        <Link to={ROUTES.EDIT_STORY(story.id)} className="secondary-btn story-edit-btn">
                          Edit Story
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default HomeView

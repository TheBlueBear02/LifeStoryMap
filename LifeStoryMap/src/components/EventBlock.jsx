import { useEffect, useRef, useState } from 'react'

function EventBlock({
  event,
  index,
  isExpanded,
  isPickingLocation,
  activeEventIndex,
  onToggleExpand,
  onChangeField,
  onUploadMainImage,
  onUploadComparisonImage,
  onRemoveComparisonImage,
  onInsertAfter,
  onDelete,
  onBeginPickLocation,
  onSearchLocation,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false)
      }
    }

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMenuOpen])

  const handleInputChange = (path, value) => {
    onChangeField(index, path, value)
  }

  const isPeriod = event.eventType === 'Period'
  const isPickingThisEvent = Boolean(isPickingLocation && activeEventIndex === index)

  return (
    <div className="event-block">
      <div className="event-block-header">
        <div className="event-block-meta-row">
          <div className="event-block-id-type">
            <span className="event-drag-handle" title="Drag to reorder">⋮⋮</span>
          </div>

          <input
            className="event-title-input"
            type="text"
            placeholder="Event title"
            value={event.title || ''}
            onChange={(e) => handleInputChange(['title'], e.target.value)}
          />

          <div className="event-header-actions">
            <button type="button" className="event-expand-btn" onClick={() => onToggleExpand(index)}>
              {isExpanded ? 'Close' : 'Edit'}
            </button>
            <div className="story-menu-container" ref={menuRef}>
              <button
                type="button"
                className="story-menu-icon"
                onClick={() => setIsMenuOpen((v) => !v)}
                aria-label="Event menu"
                aria-expanded={isMenuOpen}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="10" cy="4" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="10" r="1.5" fill="currentColor" />
                  <circle cx="10" cy="16" r="1.5" fill="currentColor" />
                </svg>
              </button>
              {isMenuOpen && (
                <div className="story-menu-dropdown">
                  <button
                    type="button"
                    className="story-menu-item"
                    onClick={() => {
                      setIsMenuOpen(false)
                      onDelete(index)
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="event-summary-row">
          <div className="event-dates">
            {isPeriod ? (
              <>
                <input
                  type="date"
                  value={event.timeline?.dateStart || ''}
                  onChange={(e) => handleInputChange(['timeline', 'dateStart'], e.target.value)}
                />
                <span className="date-separator">–</span>
                <input
                  type="date"
                  value={event.timeline?.dateEnd || ''}
                  onChange={(e) => handleInputChange(['timeline', 'dateEnd'], e.target.value)}
                />
              </>
            ) : (
              <input
                type="date"
                value={event.timeline?.dateStart || ''}
                onChange={(e) => handleInputChange(['timeline', 'dateStart'], e.target.value)}
              />
            )}
          </div>
          <div className="event-location">
            <input
              className="event-location-input"
              type="text"
              placeholder="Location name"
              value={event.location?.name || ''}
              onChange={(e) => handleInputChange(['location', 'name'], e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && onSearchLocation) {
                  e.preventDefault()
                  onSearchLocation(index, e.currentTarget.value)
                }
              }}
            />
            <button
              type="button"
              className={`choose-location-btn${isPickingThisEvent ? ' is-picking' : ''}`}
              onClick={() => {
                if (onBeginPickLocation) {
                  onBeginPickLocation(index)
                }
              }}
              title="Choose location on map"
              aria-pressed={isPickingThisEvent}
            >
              📍
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="event-details">
          <div className="event-details-section">
            <h3>Content</h3>
            <label>
              Text
              <textarea
                className="event-text-rtl"
                value={event.content?.textHtml || ''}
                onChange={(e) => handleInputChange(['content', 'textHtml'], e.target.value)}
              />
            </label>
            {event.content?.imageComparison && (
              <div className="image-comparison-section">
                <div className="image-comparison-row">
                  <label className="file-input-label">
                    Main image
                    {event.content.imageComparison.urlOld ? (
                      <div className="image-preview-container">
                        <img
                          src={event.content.imageComparison.urlOld}
                          alt="Main image preview"
                          className="image-preview"
                        />
                        <button
                          type="button"
                          className="image-remove-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (onRemoveComparisonImage) {
                              onRemoveComparisonImage(index, 'old')
                            }
                          }}
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="file-input-button">
                          <span className="file-input-icon" aria-hidden="true">⭱</span>
                          <span>Choose file</span>
                        </button>
                        <input
                          className="file-input-native"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file && onUploadComparisonImage) {
                              onUploadComparisonImage(index, 'old', file)
                            }
                          }}
                        />
                      </>
                    )}
                  </label>
                  <label className="image-comparison-new-version file-input-label">
                    New version (optional)
                    {event.content.imageComparison.urlNew ? (
                      <div className="image-preview-container">
                        <img
                          src={event.content.imageComparison.urlNew}
                          alt="New version preview"
                          className="image-preview"
                        />
                        <button
                          type="button"
                          className="image-remove-btn"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            if (onRemoveComparisonImage) {
                              onRemoveComparisonImage(index, 'new')
                            }
                          }}
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="file-input-button">
                          <span className="file-input-icon" aria-hidden="true">⭱</span>
                          <span>Choose file</span>
                        </button>
                        <input
                          className="file-input-native"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file && onUploadComparisonImage) {
                              onUploadComparisonImage(index, 'new', file)
                            }
                          }}
                        />
                      </>
                    )}
                  </label>
                </div>
                <label>
                  Image Caption
                  <input
                    className="rtl-input"
                    type="text"
                    value={event.content.imageComparison.caption || ''}
                    onChange={(e) =>
                      handleInputChange(
                        ['content', 'imageComparison', 'caption'],
                        e.target.value,
                      )
                    }
                  />
                </label>
              </div>
            )}
          </div>
          
          <div className="event-details-section">
            <h3>Transition to Next Event</h3>
            <label>
              Transport Type
              <div className="transport-type-selector">
                {[
                  { value: 'walking', label: 'Walking', icon: '🚶' },
                  { value: 'car', label: 'Car', icon: '🚗' },
                  { value: 'train', label: 'Train', icon: '🚂' },
                  { value: 'airplane', label: 'Airplane', icon: '✈️' },
                  { value: 'horse', label: 'Horse', icon: '🐴' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`transport-type-option ${
                      (event.transition?.transportType || 'airplane') === option.value ? 'active' : ''
                    }`}
                    onClick={() => handleInputChange(['transition', 'transportType'], option.value)}
                    title={option.label}
                  >
                    <span className="transport-type-icon">{option.icon}</span>
                    <span className="transport-type-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </label>
          </div>
        </div>
      )}

    </div>
  )
}

export default EventBlock

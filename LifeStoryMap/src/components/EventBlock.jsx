function EventBlock({
  event,
  index,
  isExpanded,
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
  const handleInputChange = (path, value) => {
    onChangeField(index, path, value)
  }

  const isPeriod = event.eventType === 'Period'

  return (
    <div className="event-block">
      <div className="event-block-header">
        <div className="event-block-meta-row">
          <div className="event-block-id-type">
            <span className="event-drag-handle" title="Drag to reorder">⋮⋮</span>
            <span className="event-id">#{event.eventId}</span>
            <select
              className="event-type-select"
              value={event.eventType || 'Event'}
              onChange={(e) => handleInputChange(['eventType'], e.target.value)}
            >
              <option value="Event">Event</option>
              <option value="Period">Period</option>
            </select>
          </div>

          <div className="event-header-actions">
            <button
              type="button"
              className="event-delete-btn"
              onClick={() => onDelete(index)}
            >
              Remove
            </button>
            <button type="button" className="event-expand-btn" onClick={() => onToggleExpand(index)}>
              {isExpanded ? 'Close' : 'Open'}
            </button>
          </div>
        </div>

        <input
          className="event-title-input"
          type="text"
          placeholder="Event title"
          value={event.title || ''}
          onChange={(e) => handleInputChange(['title'], e.target.value)}
        />

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
              className="choose-location-btn"
              onClick={() => {
                if (onBeginPickLocation) {
                  onBeginPickLocation(index)
                }
              }}
              title="Choose location on map"
            >
              📍
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="event-details">
          <div className="event-details-section">
            <h3>Transition</h3>
            <div className="transition-row">
              <label>
                Type
                <select
                  value={event.transition?.type || 'ArcFlyWithPoint'}
                  onChange={(e) => handleInputChange(['transition', 'type'], e.target.value)}
                >
                  <option value="ArcFlyWithPoint">Arc fly with point</option>
                  <option value="FlyTo">Fly to</option>
                  <option value="Instant">Instant jump</option>
                </select>
              </label>
              <label className="transition-duration-field">
                Duration (seconds)
                <input
                  type="number"
                  min="0"
                  value={event.transition?.durationSeconds ?? ''}
                  onChange={(e) =>
                    handleInputChange(
                      ['transition', 'durationSeconds'],
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </label>
              <label>
                Line style key
                <select
                  value={event.transition?.lineStyleKey || ''}
                  onChange={(e) => handleInputChange(['transition', 'lineStyleKey'], e.target.value)}
                >
                  <option value="">None</option>
                  <option value="GoldenAgePath">Golden age path</option>
                  <option value="MemoryTrail">Memory trail</option>
                  <option value="ImportantJump">Important jump</option>
                </select>
              </label>
            </div>
          </div>

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
                    Add new version
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
                  Caption
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
        </div>
      )}

    </div>
  )
}

export default EventBlock

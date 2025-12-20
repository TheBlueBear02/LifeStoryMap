// Route path constants
export const ROUTES = {
  HOME: '/',
  CREATE_STORY: '/create-story',
  EDIT_STORY: (storyId) => `/edit-story/${storyId}`,
  VIEW_STORY: (storyId) => `/view-story/${storyId}`,
}

// API endpoint paths
export const API_PATHS = {
  STORIES: '/api/stories',
  STORY: (storyId) => `/api/stories/${storyId}`,
  STORY_EVENTS: (storyId) => `/api/stories/${storyId}/events`,
  EXAMPLE_STORIES: '/api/example-stories',
  EXAMPLE_STORY: (storyId) => `/api/example-stories/${storyId}`,
  EXAMPLE_STORY_EVENTS: (storyId) => `/api/example-stories/${storyId}/events`,
  UPLOAD_IMAGE: '/api/upload-image',
}


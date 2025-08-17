# Memories Feature

## 🎯 Overview
Implement an intelligent memories feature that automatically creates meaningful photo collections based on time, location, people, and events - similar to Google Photos memories.

## 📋 Requirements

### Functional Requirements
- Automatically generate memories from photo collections
- Create memories based on:
  - Date-based memories (1 year ago, 5 years ago)
  - Location-based memories (trips, places visited)
  - People-based memories (family gatherings, friends)
  - Event-based memories (holidays, celebrations)
  - Seasonal memories (summer, winter activities)
- Interactive memory viewing with slideshow
- Memory sharing capabilities
- Memory customization (add/remove photos)
- Memory notifications and reminders

### Memory Types
- **This Day**: Photos from same date in previous years
- **Trips**: Location-based photo collections
- **People**: Face recognition-based groupings
- **Recent Highlights**: Best photos from recent weeks
- **Seasonal**: Weather/season-based collections
- **Events**: Holiday and celebration collections
- **Custom**: User-created memory themes

## 🏗️ Technical Specifications

### Database Schema
```sql
CREATE TABLE memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    memory_type VARCHAR(50) NOT NULL, -- 'thisday', 'trip', 'people', 'seasonal', etc.
    start_date DATE,
    end_date DATE,
    location_name VARCHAR(255),
    location_coordinates POINT,
    cover_photo_id UUID REFERENCES files(id),
    metadata JSONB, -- Store additional memory-specific data
    photo_count INTEGER DEFAULT 0,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_shared BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(20) DEFAULT 'private', -- 'private', 'family', 'public'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE memory_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    is_key_photo BOOLEAN DEFAULT FALSE,
    added_automatically BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(memory_id, photo_id)
);

CREATE TABLE memory_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    memory_type VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    notification_enabled BOOLEAN DEFAULT TRUE,
    min_photos INTEGER DEFAULT 3,
    max_photos INTEGER DEFAULT 50,
    settings JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, memory_type)
);

-- Indexes
CREATE INDEX idx_memories_user_id ON memories(user_id);
CREATE INDEX idx_memories_type ON memories(memory_type);
CREATE INDEX idx_memories_date_range ON memories(start_date, end_date);
CREATE INDEX idx_memory_photos_memory_id ON memory_photos(memory_id);
```

### Memory Generation Algorithms

#### This Day Memories
```javascript
const generateThisDayMemories = async (userId, currentDate) => {
  const sameDayPhotos = await db.query(`
    SELECT * FROM files 
    WHERE user_id = $1 
    AND EXTRACT(MONTH FROM taken_at) = $2 
    AND EXTRACT(DAY FROM taken_at) = $3
    AND EXTRACT(YEAR FROM taken_at) < $4
    ORDER BY taken_at DESC
    LIMIT 50
  `, [userId, currentDate.getMonth() + 1, currentDate.getDate(), currentDate.getFullYear()]);
  
  // Group by year and create memories
  const memoriesByYear = groupPhotosByYear(sameDayPhotos);
  return memoriesByYear.map(yearGroup => createMemory(yearGroup));
};
```

#### Trip Memories
```javascript
const generateTripMemories = async (userId) => {
  // Cluster photos by location and time proximity
  const photosWithLocation = await getPhotosWithGPS(userId);
  const clusters = spatialTemporalClustering(photosWithLocation, {
    maxDistance: 50000, // 50km
    maxTimeDiff: 24 * 60 * 60 * 1000, // 24 hours
    minPhotos: 5
  });
  
  return clusters.map(cluster => ({
    type: 'trip',
    title: await getLocationName(cluster.centerLat, cluster.centerLng),
    photos: cluster.photos,
    startDate: cluster.startDate,
    endDate: cluster.endDate,
    location: cluster.location
  }));
};
```

### AI-Powered Memory Enhancement
```javascript
const enhanceMemoryWithAI = async (memory) => {
  // Use AI to analyze photos and suggest better titles/descriptions
  const photoAnalysis = await analyzePhotosWithAI(memory.photos);
  
  return {
    ...memory,
    suggestedTitle: photoAnalysis.suggestedTitle,
    suggestedDescription: photoAnalysis.description,
    keyMoments: photoAnalysis.keyMoments,
    emotions: photoAnalysis.detectedEmotions,
    activities: photoAnalysis.detectedActivities
  };
};
```

## 📝 Sub-Tasks

### Phase 12.1: Core Memory Infrastructure
- [ ] Create memory database schema
- [ ] Implement basic memory CRUD operations
- [ ] Create memory generation service architecture
- [ ] Set up background job processing
- [ ] Implement memory preferences system

**Effort:** 1 week
**Priority:** Medium

### Phase 12.2: This Day Memories
- [ ] Implement date-based photo clustering
- [ ] Create This Day memory generation algorithm
- [ ] Add memory title generation
- [ ] Implement memory cover photo selection
- [ ] Create automated daily memory generation job

**Effort:** 4 days
**Priority:** Medium

### Phase 12.3: Location-Based Memories
- [ ] Implement GPS data clustering algorithm
- [ ] Create trip detection logic
- [ ] Integrate reverse geocoding for location names
- [ ] Generate location-based memory titles
- [ ] Add map integration for trip visualization

**Effort:** 1 week
**Priority:** Medium

### Phase 12.4: Advanced Memory Types
- [ ] Implement seasonal memory detection
- [ ] Create event-based memory generation
- [ ] Add people-based memories (requires face recognition)
- [ ] Implement recent highlights algorithm
- [ ] Create custom memory creation tools

**Effort:** 1.5 weeks
**Priority:** Low

### Phase 12.5: Memory Interface
- [ ] Create memory gallery component
- [ ] Implement memory slideshow viewer
- [ ] Add memory editing capabilities
- [ ] Create memory sharing interface
- [ ] Implement memory notifications

**Effort:** 1 week
**Priority:** Medium

### Phase 12.6: AI Enhancement
- [ ] Integrate with AI service for photo analysis
- [ ] Implement smart memory title generation
- [ ] Add emotion and activity detection
- [ ] Create memory quality scoring
- [ ] Implement personalized memory recommendations

**Effort:** 2 weeks
**Priority:** Low

## 🔧 Implementation Details

### Environment Variables
```env
MEMORY_GENERATION_INTERVAL=daily
AI_SERVICE_API_KEY=your-ai-service-key
GEOCODING_API_KEY=your-geocoding-key
MAX_MEMORY_PHOTOS=50
MIN_MEMORY_PHOTOS=3
```

### Dependencies
**Backend:**
- node-cron (scheduled jobs)
- geolib (location calculations)
- @turf/turf (geospatial operations)
- ml-kmeans (clustering)
- axios (external APIs)

**Frontend:**
- react-spring (animations)
- framer-motion (memory transitions)
- react-map-gl (location visualization)
- swiper (slideshow)

### API Endpoints
```
GET /api/memories                    # Get user memories
GET /api/memories/:id               # Get specific memory
POST /api/memories                  # Create custom memory
PUT /api/memories/:id               # Update memory
DELETE /api/memories/:id            # Delete memory
POST /api/memories/:id/share        # Share memory
GET /api/memories/thisday           # Get this day memories
POST /api/memories/generate         # Trigger memory generation
PUT /api/memories/preferences       # Update memory preferences
```

## 🧪 Testing Strategy

### Unit Tests
- Memory generation algorithms
- Clustering algorithms
- Date/time calculations
- Location distance calculations

### Integration Tests
- Memory creation workflow
- Photo assignment to memories
- Memory sharing functionality
- Background job processing

### Performance Tests
- Large photo collection processing
- Memory generation speed
- Database query optimization

## 🚀 Deployment Considerations

- Background job queue setup (Redis/SQS)
- Cron job scheduling
- AI service integration limits
- Geocoding API rate limits
- Database indexing for large datasets

## 📊 Success Metrics

- Memory generation accuracy > 85%
- User engagement with memories > 60%
- Memory creation time < 10 seconds
- Memory sharing rate > 20%
- User satisfaction score > 4.0/5.0

## 🔗 Related Features

- [Face Recognition](./11-face-recognition.md) - People-based memories
- [AI Tagging](./10-ai-tagging.md) - Content analysis
- [Metadata Extraction](./09-metadata-extraction.md) - Location and date data
- [Photo Sharing](./17-sharing.md) - Memory sharing capabilities

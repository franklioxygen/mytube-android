# As-Is Architecture (Brownfield)

## Current System Overview
MyTube Android is a React Native application using a feature-based architecture with centralized state management via React Context and TanStack Query.

## Components and Responsibilities

### Directory Structure
```
mytube-android/
├── src/
│   ├── core/           # Shared utilities, configs, repositories
│   │   ├── api/       # API endpoints and client
│   │   ├── auth/      # Authentication context
│   │   ├── config/    # Backend URL storage
│   │   ├── repositories/  # Data access layer
│   │   └── utils/    # Helper functions
│   ├── features/       # Feature-based modules
│   │   ├── auth/
│   │   ├── bootstrap/ # Backend URL setup
│   │   ├── collections/
│   │   ├── downloads/
│   │   ├── home/
│   │   ├── manage/
│   │   ├── player/
│   │   ├── search/
│   │   ├── settings/
│   │   ├── subscriptions/
│   │   └── author/
│   ├── hooks/          # Custom React hooks
│   └── types/          # TypeScript definitions
├── react-native-android-mvp/  # MVP documentation and API specs
└── docs/              # Project documentation
```

### Key Technologies
- **Framework**: React Native 0.76+
- **State Management**: React Context + TanStack Query v5
- **Navigation**: React Navigation (screen-based)
- **Language**: TypeScript
- **API Communication**: REST (JSON)

### Data Flow
1. Repositories call API endpoints in core/api/
2. TanStack Query caches and manages server state
3. Context providers expose state to UI components
4. Features contain screens and related logic

## Known Pain Points
1. **API Compatibility**: Recent backend updates may have broken endpoints
2. **Missing Docs**: Documentation incomplete (05-???? missing)
3. **No E2E Tests**: Detox tests are placeholders only
4. **State Management**: Complex context setup may need simplification
5. **Error Handling**: Polling and error recovery patterns need review

## Code Metrics
- Total Source Files: 74 TypeScript/TSX files
- Total Lines of Code: ~8,336 (src + react-native-android-mvp)
- Test Coverage: Minimal (placeholder tests only)

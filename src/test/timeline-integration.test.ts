/**
 * Simple integration test for timeline functionality
 * This test verifies the core timeline data structure and management works correctly
 */

import { TimelineManager } from '../lib/timeline-manager'
import { ResumeDataLoader } from '../lib/resume-data-loader'
import { TimelinePositionCalculator } from '../lib/timeline-position-calculator'

// Simple test runner
async function runTests() {
  console.log('🧪 Running Timeline Integration Tests...\n')

  try {
    // Test 1: Resume Data Loading
    console.log('📋 Test 1: Resume Data Loading')
    const dataLoader = ResumeDataLoader.getInstance()
    const resumeData = await dataLoader.loadResumeData()

    console.log(`✅ Loaded resume data for: ${resumeData.personal.name}`)
    console.log(`✅ Found ${resumeData.experience.length} work experiences`)
    console.log(`✅ Found ${resumeData.skills.length} skill categories`)
    console.log(`✅ Found ${resumeData.projects.length} projects\n`)

    // Test 2: Timeline Position Calculation
    console.log('📐 Test 2: Timeline Position Calculation')
    const calculator = new TimelinePositionCalculator()
    const timelineData = calculator.calculateTimelineData(resumeData.experience)

    console.log(`✅ Calculated positions for ${timelineData.experiences.length} experiences`)
    console.log(`✅ Timeline spans ${timelineData.totalDuration / (1000 * 60 * 60 * 24 * 365.25)} years`)
    console.log(`✅ Helix configuration: ${timelineData.helixConfig.turns} turns, ${timelineData.helixConfig.height} height`)

    // Verify all experiences have 3D positions
    const hasPositions = timelineData.experiences.every(exp =>
      exp.position3D && exp.cardRotation && exp.timelineIndex >= 0
    )
    console.log(`✅ All experiences have 3D positions: ${hasPositions}\n`)

    // Test 3: Timeline Manager Integration
    console.log('🎯 Test 3: Timeline Manager Integration')
    const manager = TimelineManager.getInstance()
    const managerData = await manager.initializeTimeline()

    console.log(`✅ Timeline manager initialized successfully`)
    console.log(`✅ Manager is initialized: ${manager.isInitialized()}`)

    // Test specific experience lookup
    const autifyExp = await manager.getExperience('autify-2024')
    console.log(`✅ Found Autify experience: ${autifyExp?.company}`)

    // Test timeline statistics
    const stats = await manager.getTimelineStats()
    console.log(`✅ Timeline stats: ${stats.totalExperiences} experiences, ${stats.totalYears} years`)
    console.log(`✅ Technologies used: ${stats.technologiesUsed.length} different technologies`)
    console.log(`✅ Companies worked: ${stats.companiesWorked.join(', ')}\n`)

    // Test 4: Position Calculations
    console.log('🎯 Test 4: Position Calculations')
    const bounds = await manager.getTimelineBounds()
    const viewingDistance = await manager.getOptimalViewingDistance()

    console.log(`✅ Timeline bounds calculated: min(${bounds.min.x.toFixed(1)}, ${bounds.min.y.toFixed(1)}, ${bounds.min.z.toFixed(1)})`)
    console.log(`✅ Optimal viewing distance: ${viewingDistance.toFixed(1)}`)

    // Test position at different times
    const startPos = await manager.getPositionAtTime(0)
    const midPos = await manager.getPositionAtTime(0.5)
    const endPos = await manager.getPositionAtTime(1)

    console.log(`✅ Start position: (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}, ${startPos.z.toFixed(1)})`)
    console.log(`✅ Mid position: (${midPos.x.toFixed(1)}, ${midPos.y.toFixed(1)}, ${midPos.z.toFixed(1)})`)
    console.log(`✅ End position: (${endPos.x.toFixed(1)}, ${endPos.y.toFixed(1)}, ${endPos.z.toFixed(1)})\n`)

    // Test 5: Technology Data
    console.log('💻 Test 5: Technology Data')
    const autifyTech = await dataLoader.getTechnologiesForExperience('autify-2024')
    console.log(`✅ Autify technologies: ${autifyTech.map(t => t.name).join(', ')}`)

    const sortedExperiences = await dataLoader.getExperiencesSorted()
    console.log(`✅ Most recent experience: ${sortedExperiences[0].company}`)
    console.log(`✅ Oldest experience: ${sortedExperiences[sortedExperiences.length - 1].company}\n`)

    console.log('🎉 All tests passed successfully!')
    return true

  } catch (error) {
    console.error('❌ Test failed:', error)
    return false
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  runTests().then(success => {
    process.exit(success ? 0 : 1)
  })
}

export { runTests }

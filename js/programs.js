// Programs Loader - Loads programs from JSON and displays them
const programsJsonUrl = 'data/programs.json';

async function loadPrograms() {
    try {
        const response = await fetch(programsJsonUrl);
        const data = await response.json();
        return data.programs;
    } catch (error) {
        console.error('Error loading programs:', error);
        return [];
    }
}

function getCategoryIcon(name) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('education') || nameLower.includes('school') || nameLower.includes('computer')) return 'fas fa-laptop';
    if (nameLower.includes('health') || nameLower.includes('medical')) return 'fas fa-heartbeat';
    if (nameLower.includes('women') || nameLower.includes('empower')) return 'fas fa-female';
    if (nameLower.includes('environment') || nameLower.includes('green') || nameLower.includes('planting') || nameLower.includes('tree')) return 'fas fa-leaf';
    if (nameLower.includes('heritage') || nameLower.includes('temple')) return 'fas fa-landmark';
    if (nameLower.includes('water') || nameLower.includes('clean')) return 'fas fa-tint';
    return 'fas fa-hands-helping';
}

function getImageForProgram(programName) {
    const name = programName.toLowerCase();
    if (name.includes('planting') || name.includes('tree')) {
        return 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&h=300&fit=crop';
    }
    if (name.includes('computer') || name.includes('skill')) {
        return 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&h=300&fit=crop';
    }
    return 'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=400&h=300&fit=crop';
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function createProgramCard(program) {
    const iconClass = getCategoryIcon(program.program_name);
    const imageUrl = getImageForProgram(program.program_name);
    
    return `
        <div class="program-card bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2">
            <!-- Image Section -->
            <div class="relative h-48 overflow-hidden">
                <img src="${imageUrl}" alt="${program.program_name}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                <div class="absolute bottom-4 left-4">
                    <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg">
                        <i class="${iconClass} text-xl text-indigo-600"></i>
                    </div>
                </div>
            </div>
            
            <!-- Content Section -->
            <div class="p-6">
                <h3 class="text-xl font-bold mb-2 text-gray-800">${program.program_name}</h3>
                <p class="text-gray-600 mb-4 line-clamp-2">${program.short_description}</p>
                
                <!-- Meta Info -->
                <div class="flex flex-wrap gap-3 text-sm text-gray-500">
                    <span class="flex items-center">
                        <i class="fas fa-map-marker-alt mr-1 text-primary"></i>
                        ${program.location}
                    </span>
                    <span class="flex items-center">
                        <i class="fas fa-calendar mr-1 text-secondary"></i>
                        ${formatDate(program.start_date)} - ${formatDate(program.end_date)}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// Load and render programs
async function renderPrograms() {
    const programs = await loadPrograms();
    
    const ongoingContainer = document.getElementById('ongoing-programs');
    const upcomingContainer = document.getElementById('upcoming-programs');
    
    if (!ongoingContainer || !upcomingContainer) {
        console.log('Program containers not found');
        return;
    }
    
    if (programs.length === 0) {
        ongoingContainer.innerHTML = '<p class="text-center text-gray-500">No programs available.</p>';
        return;
    }
    
    // Show all programs in ongoing section
    ongoingContainer.innerHTML = programs.map(createProgramCard).join('');
    upcomingContainer.innerHTML = '';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', renderPrograms);

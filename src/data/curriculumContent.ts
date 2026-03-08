// Curriculum content types and utilities for lesson plan generation

export interface CurriculumTopic {
  title: string;
  objectives: string[];
  subtopics?: string[];
}

export interface CurriculumContent {
  country: string;
  level: string;
  subject: string;
  description: string;
  topics: CurriculumTopic[];
}

// Topic item for dropdown selection with enhanced curriculum alignment
export interface TopicItem {
  id: string;
  title: string;
  strand: string; // Category: Sets & Logic, Numbers & Operations, etc.
  objectives: string[];
  suggestedMaterials?: string[];
  // Enhanced curriculum alignment fields
  subtopics?: string[];
  teachingMethodology?: string[];
  suggestedActivities?: {
    warmUp?: string[];
    mainActivities?: string[];
    practicalTasks?: string[];
    applicationTasks?: string[];
  };
  assessmentMethods?: string[];
  remediationStrategies?: string[];
  extensionActivities?: string[];
  previousKnowledge?: string;
  realLifeApplications?: string[];
  crossCurricularLinks?: string[];
  weeklyPlacement?: number; // Week number in term scheme
  termPlacement?: number; // Which term this topic belongs to
}

// Class-specific curriculum with topics for dropdown
export interface ClassCurriculum {
  country: string;
  classLevel: string;
  subject: string;
  description: string;
  topics: TopicItem[];
}

// Class levels for different countries (Primary 1-6 only)
const CLASS_LEVELS = {
  nigeria: [
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'
  ],
  cameroon: [
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'
  ]
};

// ==========================================
// CAMEROON CURRICULUM - CLASS-SPECIFIC TOPICS
// ==========================================

const CAMEROON_PRIMARY_1_TOPICS: TopicItem[] = [
  // SETS AND LOGIC - WEEK 1
  {
    id: 'cm-p1-sets-1',
    title: 'Sets and Objects',
    strand: 'Sets and Logic',
    objectives: [
      'Identify objects in their environment',
      'Group objects into simple sets (e.g., cups, stones, pencils)',
      'Understand the meaning of a set'
    ],
    subtopics: ['Meaning of a set', 'Identifying objects around us', 'Grouping objects into sets'],
    suggestedMaterials: ['Real objects (pebbles, sticks, blocks)', 'Charts', 'Pictures', 'Flashcards', 'Sorting trays'],
    teachingMethodology: ['Sorting real objects in class', 'Matching objects with pictures', 'Group work classification', 'Cooperative learning'],
    suggestedActivities: {
      warmUp: ['Counting songs', 'Show and tell with classroom objects'],
      mainActivities: ['Sort real objects by type', 'Match objects with pictures on charts', 'Group work: classify objects into cups, pencils, books'],
      practicalTasks: ['Learners sort objects from their school bags', 'Create sets using items from the classroom'],
      applicationTasks: ['Object hunt: find and group similar objects around the school']
    },
    assessmentMethods: ['Learners sort objects correctly', 'Oral questions about sets', 'Observation of group work'],
    remediationStrategies: ['Pair work with tutor for slow learners', 'Extra practice with more concrete objects (stones, bottle tops)', 'Individual guidance during sorting activities'],
    extensionActivities: ['Create sets with more than 10 objects', 'Sort objects by multiple attributes', 'Draw pictures of sets'],
    previousKnowledge: 'Learners can identify common objects in their environment',
    realLifeApplications: ['Organizing school supplies', 'Sorting items at home', 'Grouping family members by age or gender'],
    crossCurricularLinks: ['Social Studies: sorting items in the community', 'Arts & Crafts: creating collages of similar objects'],
    weeklyPlacement: 1,
    termPlacement: 1
  },
  // SETS AND LOGIC - WEEK 2
  {
    id: 'cm-p1-sets-2',
    title: 'Classifying Sets by Attributes',
    strand: 'Sets and Logic',
    objectives: [
      'Classify objects by two attributes (colour & size)',
      'Represent sets using simple Venn diagrams',
      'Sort objects by shape, colour, and size'
    ],
    subtopics: ['Colour attributes', 'Shape attributes', 'Size attributes', 'Simple Venn diagrams'],
    suggestedMaterials: ['Shape cut-outs', 'Coloured counters', 'Charts', 'Venn diagram templates', 'Coloured blocks'],
    teachingMethodology: ['Classroom treasure hunt (finding colours/shapes)', 'Drawing simple circles to show sets', 'Hands-on sorting activities', 'Visual demonstrations'],
    suggestedActivities: {
      warmUp: ['Colour song', 'Shape recognition game'],
      mainActivities: ['Treasure hunt: find objects by colour and shape', 'Draw Venn diagrams on the board', 'Sort counters by two attributes'],
      practicalTasks: ['Learners draw simple Venn diagrams', 'Group objects by colour AND size'],
      applicationTasks: ['Classify items in their pencil case by colour and type']
    },
    assessmentMethods: ['Worksheet: learners group pictures according to attributes', 'Observation of sorting activities', 'Oral description of Venn diagram'],
    remediationStrategies: ['Start with one attribute before two', 'Use larger, more distinct objects', 'Peer tutoring'],
    extensionActivities: ['Create Venn diagrams with three circles', 'Sort objects by three attributes'],
    previousKnowledge: 'Learners can identify objects and group them into simple sets',
    realLifeApplications: ['Organizing clothes by colour', 'Sorting toys by type and size'],
    crossCurricularLinks: ['Arts & Crafts: colour mixing', 'Science: classifying living things'],
    weeklyPlacement: 2,
    termPlacement: 1
  },
  // NUMBERS AND OPERATIONS - WEEK 3
  {
    id: 'cm-p1-num-1',
    title: 'Numbers 0-20',
    strand: 'Numbers and Operations',
    objectives: [
      'Count numbers 0-20 correctly (forward and backward)',
      'Write numbers in figures and words (0-20)',
      'Match numbers to quantities using objects'
    ],
    subtopics: ['Counting forward 0-20', 'Counting backward 20-0', 'Reading numbers', 'Writing numbers in figures', 'Writing numbers in words', 'Matching numbers to quantities'],
    suggestedMaterials: ['Number chart', 'Counters', 'Flashcards', 'Number songs', 'Exercise books'],
    teachingMethodology: ['Counting songs and chants', 'Filling number charts', 'Counting real objects', 'Drilling', 'Pair work'],
    suggestedActivities: {
      warmUp: ['Number song: "One, two, buckle my shoe"', 'Clapping and counting'],
      mainActivities: ['Use number cards to teach recognition', 'Group learners to arrange numbers in order', 'Peer pairing to read numbers aloud'],
      practicalTasks: ['Each learner writes numbers 0-20 in words and figures', 'Use real objects to show quantities'],
      applicationTasks: ['Number hunt: find and write number cards around the classroom']
    },
    assessmentMethods: ['Number dictation', 'Counting tasks', 'Oral count by 2s', 'Write selected numbers', 'Peer review'],
    remediationStrategies: ['Paired counting with tutor', 'Extra practice with ten-frames', 'Use finger counting', 'Repetitive drilling'],
    extensionActivities: ['Count backwards from 20', 'Skip-count by 2s', 'Write numbers up to 50'],
    previousKnowledge: 'Learners can identify and name objects; basic oral counting',
    realLifeApplications: ['Counting items at home', 'Numbering pages', 'Counting money'],
    crossCurricularLinks: ['Language: number words', 'Music: counting songs'],
    weeklyPlacement: 3,
    termPlacement: 1
  },
  {
    id: 'cm-p1-num-2',
    title: 'Numbers 0-50',
    strand: 'Numbers and Operations',
    objectives: [
      'Count, read and write numbers up to 50',
      'Understand tens and units (place value)',
      'Compare numbers using more than, less than'
    ],
    subtopics: ['Counting 21-50', 'Place value introduction', 'Comparing numbers', 'Ordering numbers'],
    suggestedMaterials: ['Number cards', 'Abacus', 'Ten-frames', 'Counting objects', 'Place value charts'],
    teachingMethodology: ['Number line activities', 'Bundling sticks in tens', 'Group counting', 'Competitive games'],
    suggestedActivities: {
      warmUp: ['Count by 10s to 50', 'Number chain game'],
      mainActivities: ['Use abacus to show numbers', 'Bundle sticks into tens and ones', 'Number comparison activities'],
      practicalTasks: ['Fill in missing numbers on number chart', 'Write numbers 21-50 in exercise books'],
      applicationTasks: ['Count items in the classroom (desks, books, etc.)']
    },
    assessmentMethods: ['Number dictation to 50', 'Place value worksheet', 'Comparison exercises'],
    remediationStrategies: ['Focus on numbers 0-30 first', 'Use more concrete materials', 'individual attention'],
    extensionActivities: ['Count to 100', 'Skip-count by 5s and 10s'],
    previousKnowledge: 'Learners can count, read, and write numbers 0-20',
    realLifeApplications: ['Counting larger quantities', 'Reading page numbers in books'],
    weeklyPlacement: 4,
    termPlacement: 1
  },
  // NUMBERS AND OPERATIONS - WEEK 4
  {
    id: 'cm-p1-num-3',
    title: 'Addition within 20',
    strand: 'Numbers and Operations',
    objectives: [
      'Understand the meaning of addition',
      'Add using concrete objects',
      'Solve simple addition sums within 20'
    ],
    subtopics: ['Meaning of addition', 'Addition symbol (+)', 'Addition with objects', 'Addition of single-digit numbers', 'Word problems'],
    suggestedMaterials: ['Counters', 'Number line', 'Addition chart', 'Beans', 'Sticks', 'Bottle tops'],
    teachingMethodology: ['Using beans/sticks for addition demonstration', 'Playing "add and count" games', 'Number line jumping', 'Story problems'],
    suggestedActivities: {
      warmUp: ['Addition song', 'Quick mental addition games'],
      mainActivities: ['Demonstrate addition using beans: "3 beans plus 2 beans equals how many?"', 'Draw addition on the board', 'Use number line for addition'],
      practicalTasks: ['Learners solve addition using their own counters', 'Complete addition worksheets'],
      applicationTasks: ['Create word problems: "I have 5 pencils, my friend gives me 3 more..."']
    },
    assessmentMethods: ['Class exercise: add numbers using drawings or objects', 'Oral addition drill', 'Written addition worksheet'],
    remediationStrategies: ['Use larger objects for visibility', 'Start with adding 1 or 2', 'Pair struggling learners with stronger ones'],
    extensionActivities: ['Addition within 50', 'Add three numbers together', 'Create own word problems'],
    previousKnowledge: 'Learners can count numbers 0-20 and recognize number symbols',
    realLifeApplications: ['Adding items when shopping', 'Counting total fingers on two hands', 'Combining groups of objects'],
    crossCurricularLinks: ['Social Studies: sharing and combining resources'],
    weeklyPlacement: 4,
    termPlacement: 1
  },
  // NUMBERS AND OPERATIONS - WEEK 5
  {
    id: 'cm-p1-num-4',
    title: 'Subtraction within 20',
    strand: 'Numbers and Operations',
    objectives: [
      'Understand the meaning of subtraction (taking away)',
      'Subtract objects from a group',
      'Solve subtraction sums within 20 using number line'
    ],
    subtopics: ['Meaning of subtraction', 'Subtraction symbol (-)', 'Taking away objects', 'Subtraction with number line', 'Word problems'],
    suggestedMaterials: ['Objects', 'Number line', 'Charts', 'Take-away games', 'Counters'],
    teachingMethodology: ['Demonstration with real objects', 'Subtraction games ("take away")', 'Number line jumping backwards', 'Story-based problems'],
    suggestedActivities: {
      warmUp: ['Subtraction song', 'Quick "take away" oral exercises'],
      mainActivities: ['Demonstrate: "I have 8 beans, I take away 3, how many left?"', 'Use number line to show subtraction', 'Role play: sharing/giving away items'],
      practicalTasks: ['Solve subtraction using counters', 'Complete subtraction worksheet'],
      applicationTasks: ['Real-life problems: "You have 10 sweets, you eat 4..."']
    },
    assessmentMethods: ['Subtraction worksheet', 'Oral demonstration', 'Practical subtraction tasks'],
    remediationStrategies: ['Use physical objects exclusively', 'Start with subtracting 1 or 2', 'Visual number line support'],
    extensionActivities: ['Subtraction within 50', 'Mix addition and subtraction', 'Create own subtraction stories'],
    previousKnowledge: 'Learners can count 0-20 and perform simple addition',
    realLifeApplications: ['Sharing items with friends', 'Spending money', 'Eating from a group of items'],
    weeklyPlacement: 5,
    termPlacement: 1
  },
  {
    id: 'cm-p1-num-5',
    title: 'Place Value: Tens and Units',
    strand: 'Numbers and Operations',
    objectives: [
      'Understand the concept of tens and units',
      'Identify the value of digits in two-digit numbers',
      'Group objects into tens and ones'
    ],
    subtopics: ['Tens and units', 'Value of digits', 'Bundling objects', 'Expanded notation'],
    suggestedMaterials: ['Base-ten blocks', 'Bundled sticks', 'Place value charts', 'Abacus'],
    teachingMethodology: ['Bundling sticks in groups of ten', 'Place value demonstrations', 'Hands-on activities'],
    suggestedActivities: {
      warmUp: ['Count by 10s', 'Bundle 10 sticks together'],
      mainActivities: ['Show that 23 = 2 tens + 3 units', 'Use base-ten blocks', 'Practice with place value charts'],
      practicalTasks: ['Learners bundle their own sticks', 'Write numbers in expanded form'],
      applicationTasks: ['Identify tens and units in age, page numbers, etc.']
    },
    assessmentMethods: ['Place value worksheet', 'Oral questions', 'Practical bundling activity'],
    remediationStrategies: ['Use only numbers 10-20 first', 'More bundling practice', 'One-on-one support'],
    extensionActivities: ['Place value to 100', 'Introduce hundreds concept'],
    previousKnowledge: 'Learners can count and write numbers 0-50',
    realLifeApplications: ['Understanding age', 'Reading prices'],
    weeklyPlacement: 6,
    termPlacement: 1
  },
  // MEASUREMENT AND SIZE - WEEK 6
  {
    id: 'cm-p1-meas-1',
    title: 'Measurement: Length and Size',
    strand: 'Measurement and Size',
    objectives: [
      'Differentiate long and short objects',
      'Compare sizes of objects (big/small)',
      'Use non-standard units to measure length'
    ],
    subtopics: ['Comparing lengths (long/short)', 'Comparing sizes (big/small)', 'Non-standard measurement'],
    suggestedMaterials: ['Classroom objects', 'Rulers', 'String', 'Pictures', 'Hand spans', 'Foot lengths'],
    teachingMethodology: ['Comparing classroom items (books, rulers)', 'Sorting objects by size/length', 'Practical measurement activities'],
    suggestedActivities: {
      warmUp: ['Show long and short objects', 'Size comparison game'],
      mainActivities: ['Compare lengths of pencils, rulers, desks', 'Sort objects by size', 'Measure using hand spans'],
      practicalTasks: ['Learners sort items according to length/size', 'Measure objects using non-standard units'],
      applicationTasks: ['Measure classroom objects and record results']
    },
    assessmentMethods: ['Learners sort items according to length/size', 'Practical measurement tasks', 'Oral questions'],
    remediationStrategies: ['Use very distinct size differences', 'Focus on one comparison at a time', 'Hands-on practice'],
    extensionActivities: ['Introduce standard units (cm)', 'Measure longer objects', 'Estimate before measuring'],
    previousKnowledge: 'Learners can identify and name objects',
    realLifeApplications: ['Choosing clothes that fit', 'Comparing heights of family members'],
    crossCurricularLinks: ['Social Studies: measuring the classroom', 'PE: comparing heights'],
    weeklyPlacement: 6,
    termPlacement: 1
  },
  {
    id: 'cm-p1-meas-2',
    title: 'Comparing Heights and Widths',
    strand: 'Measurement and Size',
    objectives: [
      'Compare heights of objects and people',
      'Identify tall and short, wide and narrow',
      'Order objects by height/width'
    ],
    subtopics: ['Tall and short', 'Wide and narrow', 'Ordering by height', 'Ordering by width'],
    suggestedMaterials: ['Height charts', 'Real objects', 'Pictures', 'String'],
    teachingMethodology: ['Standing learners by height', 'Visual comparisons', 'Practical ordering activities'],
    suggestedActivities: {
      warmUp: ['Height comparison of two learners', 'Show tall/short pictures'],
      mainActivities: ['Compare heights of learners', 'Order objects by height', 'Identify wide and narrow objects'],
      practicalTasks: ['Learners stand in height order', 'Draw tall and short objects'],
      applicationTasks: ['Compare heights of items at home']
    },
    assessmentMethods: ['Ordering activity', 'Oral questions', 'Drawing task'],
    remediationStrategies: ['Focus on height only first', 'Use very distinct differences', 'Peer support'],
    extensionActivities: ['Order 5+ items by height', 'Measure actual heights'],
    previousKnowledge: 'Learners can compare lengths and sizes',
    realLifeApplications: ['Understanding growth', 'Comparing family members'],
    weeklyPlacement: 6,
    termPlacement: 1
  },
  {
    id: 'cm-p1-meas-3',
    title: 'Capacity: Comparing Containers',
    strand: 'Measurement and Size',
    objectives: [
      'Compare capacities of containers (full/empty)',
      'Use terms: more, less, same',
      'Estimate and compare using water/sand'
    ],
    subtopics: ['Full and empty', 'More and less', 'Same capacity', 'Comparing using water/sand'],
    suggestedMaterials: ['Containers', 'Water', 'Sand', 'Cups', 'Bottles'],
    teachingMethodology: ['Pouring activities', 'Estimation games', 'Comparative demonstrations'],
    suggestedActivities: {
      warmUp: ['Show full and empty containers', 'Prediction game'],
      mainActivities: ['Pour water between containers', 'Compare which holds more', 'Use terms: more, less, same'],
      practicalTasks: ['Learners compare containers using water/sand', 'Record findings'],
      applicationTasks: ['Compare containers at home']
    },
    assessmentMethods: ['Practical comparison task', 'Oral questions', 'Observation'],
    remediationStrategies: ['Use larger differences in capacity', 'More hands-on time', 'Individual support'],
    extensionActivities: ['Introduce standard units (litres)', 'Order containers by capacity'],
    previousKnowledge: 'Learners can compare sizes of objects',
    realLifeApplications: ['Choosing containers for drinks', 'Understanding full and empty'],
    weeklyPlacement: 7,
    termPlacement: 1
  },
  // MEASUREMENT AND SIZE - WEEK 7
  {
    id: 'cm-p1-meas-4',
    title: 'Time: Days of the Week',
    strand: 'Measurement and Size',
    objectives: [
      'Recite the seven days of the week in order',
      'Match day names to activities/events',
      'Understand today, yesterday, tomorrow'
    ],
    subtopics: ['Names of days', 'Order of days', 'Events of each day', 'Today, yesterday, tomorrow'],
    suggestedMaterials: ['Calendar chart', 'Flashcards', 'Days of the week song', 'Pictures of activities'],
    teachingMethodology: ['Singing "days of the week" song', 'Creating a class schedule', 'Role-play daily activities', 'Calendar reference'],
    suggestedActivities: {
      warmUp: ['Sing "Days of the Week" song', 'Ask "What day is today?"'],
      mainActivities: ['Teach day names with flashcards', 'Create class weekly schedule', 'Match days to typical activities'],
      practicalTasks: ['Learners recite days in order', 'Draw activities for each day'],
      applicationTasks: ['Tell what they do on each day at home']
    },
    assessmentMethods: ['Oral recitation', 'Matching exercises', 'Sequence ordering'],
    remediationStrategies: ['Daily repetition of song', 'Focus on weekday vs weekend first', 'Visual calendar reference'],
    extensionActivities: ['Learn days in another language (French)', 'Sequence events within a day'],
    previousKnowledge: 'Basic language skills and daily routines',
    realLifeApplications: ['Planning activities', 'Understanding school schedule', 'Family routines'],
    crossCurricularLinks: ['Language: day names', 'Social Studies: community activities'],
    weeklyPlacement: 7,
    termPlacement: 1
  },
  {
    id: 'cm-p1-meas-5',
    title: 'Money: Coins up to 100 FCFA',
    strand: 'Measurement and Size',
    objectives: [
      'Identify and name Cameroonian coins',
      'Count coins up to 100 FCFA',
      'Use money in simple buying/selling activities'
    ],
    subtopics: ['Coin identification', 'Coin values', 'Counting coins', 'Simple transactions'],
    suggestedMaterials: ['Play money', 'Real coins', 'Shop role-play materials', 'Price tags'],
    teachingMethodology: ['Shop role-play', 'Coin sorting activities', 'Simple buying/selling games'],
    suggestedActivities: {
      warmUp: ['Show and identify coins', 'Coin matching game'],
      mainActivities: ['Name coins and their values', 'Count coins to make amounts', 'Role-play buying items'],
      practicalTasks: ['Sort coins by value', 'Make 50F and 100F using different coins'],
      applicationTasks: ['Practice buying snacks with exact change']
    },
    assessmentMethods: ['Coin identification test', 'Counting exercise', 'Role-play assessment'],
    remediationStrategies: ['Focus on fewer coin types', 'More handling practice', 'Pair with stronger learner'],
    extensionActivities: ['Count to 200F', 'Calculate change', 'Create own shop'],
    previousKnowledge: 'Learners can count numbers up to 50',
    realLifeApplications: ['Buying items at school', 'Saving money', 'Helping parents at market'],
    crossCurricularLinks: ['Social Studies: trade and commerce', 'Entrepreneurship'],
    weeklyPlacement: 8,
    termPlacement: 1
  },
  // GEOMETRY AND SPACE - WEEK 8
  {
    id: 'cm-p1-geo-1',
    title: 'Basic Shapes: Circle, Square, Triangle, Rectangle',
    strand: 'Geometry and Space',
    objectives: [
      'Identify and name basic 2D shapes',
      'Draw simple shapes',
      'Find shapes in the environment'
    ],
    subtopics: ['Naming shapes', 'Shape properties (sides, corners)', 'Identifying shapes in environment', 'Drawing shapes'],
    suggestedMaterials: ['Shape cut-outs', 'Charts', 'Real objects', 'Geo-boards', 'Drawing materials'],
    teachingMethodology: ['Shape-hunt around the school', 'Shape-drawing on slates/books', 'Sorting shapes', 'Touch-and-feel activities'],
    suggestedActivities: {
      warmUp: ['Shape song', 'Show shapes and ask names'],
      mainActivities: ['Introduce each shape with cut-outs', 'Count sides and corners', 'Find shapes in classroom'],
      practicalTasks: ['Draw shapes on slate/exercise book', 'Create shapes using geo-boards'],
      applicationTasks: ['Shape hunt: find and name shapes around school']
    },
    assessmentMethods: ['Draw and name shapes', 'Shape identification test', 'Counting sides/corners'],
    remediationStrategies: ['Focus on one shape at a time', 'More tactile activities', 'Peer support'],
    extensionActivities: ['Learn more shapes (oval, diamond)', 'Create pictures using shapes', 'Compare shape sizes'],
    previousKnowledge: 'Learners can sort objects by attributes',
    realLifeApplications: ['Recognizing shapes in buildings, signs', 'Art and design'],
    crossCurricularLinks: ['Arts & Crafts: shape art', 'Vocational Studies: construction'],
    weeklyPlacement: 8,
    termPlacement: 1
  },
  {
    id: 'cm-p1-geo-2',
    title: 'Simple Patterns with Shapes',
    strand: 'Geometry and Space',
    objectives: [
      'Recognize patterns with shapes and colours',
      'Complete simple patterns',
      'Create own patterns using shapes'
    ],
    subtopics: ['AB patterns', 'ABC patterns', 'Extending patterns', 'Creating patterns'],
    suggestedMaterials: ['Pattern cards', 'Coloured shapes', 'Beads', 'Blocks'],
    teachingMethodology: ['Pattern demonstrations', 'Hands-on pattern making', 'Pattern games'],
    suggestedActivities: {
      warmUp: ['Clap pattern game', 'Show simple patterns'],
      mainActivities: ['Demonstrate AB patterns', 'Learners extend patterns', 'Create patterns with shapes'],
      practicalTasks: ['Complete pattern worksheets', 'String beads in patterns'],
      applicationTasks: ['Find patterns in fabric, tiles, nature']
    },
    assessmentMethods: ['Pattern completion task', 'Creating own pattern', 'Observation'],
    remediationStrategies: ['Start with simple AB patterns', 'Use concrete materials only', 'Individual guidance'],
    extensionActivities: ['Create complex patterns', 'Pattern with numbers', 'Growing patterns'],
    previousKnowledge: 'Learners can identify basic shapes and colours',
    realLifeApplications: ['Recognizing patterns in clothes, tiles', 'Art and decoration'],
    weeklyPlacement: 8,
    termPlacement: 1
  },
  {
    id: 'cm-p1-geo-3',
    title: 'Lines and Curves',
    strand: 'Geometry and Space',
    objectives: [
      'Differentiate between straight lines and curves',
      'Draw straight lines and curved lines',
      'Identify lines and curves in objects'
    ],
    subtopics: ['Straight lines', 'Curved lines', 'Lines in shapes', 'Lines in environment'],
    suggestedMaterials: ['Rulers', 'String', 'Drawing materials', 'Objects with lines/curves'],
    teachingMethodology: ['Drawing exercises', 'Object identification', 'Comparison activities'],
    suggestedActivities: {
      warmUp: ['Draw in the air: straight then curved', 'Show line examples'],
      mainActivities: ['Use ruler to draw straight lines', 'Draw curves freehand', 'Find lines/curves in classroom'],
      practicalTasks: ['Practice drawing both types', 'Sort objects by line type'],
      applicationTasks: ['Find lines and curves at home']
    },
    assessmentMethods: ['Drawing task', 'Identification exercise', 'Oral questions'],
    remediationStrategies: ['More physical tracing activities', 'Large-scale drawing', 'Peer support'],
    extensionActivities: ['Draw pictures using only lines', 'Introduce line segments'],
    previousKnowledge: 'Learners can identify basic shapes',
    realLifeApplications: ['Understanding edges of objects', 'Drawing and writing'],
    weeklyPlacement: 9,
    termPlacement: 1
  },
  // GRAPHS AND STATISTICS
  {
    id: 'cm-p1-data-1',
    title: 'Sorting and Grouping Objects',
    strand: 'Graphs and Statistics',
    objectives: [
      'Sort objects by different attributes',
      'Count objects in each group',
      'Present findings orally'
    ],
    subtopics: ['Sorting by colour', 'Sorting by size', 'Sorting by type', 'Counting groups', 'Presenting findings'],
    suggestedMaterials: ['Real objects', 'Sorting trays', 'Charts', 'Pictures'],
    teachingMethodology: ['Hands-on sorting activities', 'Group work', 'Oral presentations'],
    suggestedActivities: {
      warmUp: ['Quick sort game', 'Guess the sorting rule'],
      mainActivities: ['Sort classroom objects', 'Count each group', 'Present to class'],
      practicalTasks: ['Learners sort their own objects', 'Record counts'],
      applicationTasks: ['Sort items at home and report']
    },
    assessmentMethods: ['Sorting observation', 'Counting accuracy', 'Oral presentation'],
    remediationStrategies: ['Use fewer categories', 'Focus on one attribute', 'Pair support'],
    extensionActivities: ['Sort by multiple attributes', 'Create sorting games'],
    previousKnowledge: 'Learners can identify attributes of objects',
    realLifeApplications: ['Organizing belongings', 'Tidying room', 'Shopping'],
    crossCurricularLinks: ['Science: classifying living things', 'Social Studies: organizing community items'],
    weeklyPlacement: 10,
    termPlacement: 1
  },
  {
    id: 'cm-p1-data-2',
    title: 'Simple Tallying',
    strand: 'Graphs and Statistics',
    objectives: [
      'Use tally marks to count objects',
      'Create simple tally charts',
      'Read and interpret tally marks'
    ],
    subtopics: ['Making tally marks', 'Tally mark bundles (5)', 'Creating tally charts', 'Reading tallies'],
    suggestedMaterials: ['Tally charts', 'Counters', 'Chalkboard', 'Worksheets'],
    teachingMethodology: ['Demonstration of tally marks', 'Class surveys', 'Hands-on tallying activities'],
    suggestedActivities: {
      warmUp: ['Count with tally marks', 'Tally game'],
      mainActivities: ['Teach tally mark symbols', 'Conduct class survey (favourite fruit)', 'Create tally chart'],
      practicalTasks: ['Learners tally classroom items', 'Create own tally charts'],
      applicationTasks: ['Tally family members, pets at home']
    },
    assessmentMethods: ['Reading tally marks', 'Creating tally chart', 'Interpreting data'],
    remediationStrategies: ['Practice with smaller numbers', 'Pair with tutor', 'Visual aids'],
    extensionActivities: ['Create pictographs', 'Tally and compare groups', 'Simple bar representations'],
    previousKnowledge: 'Learners can count and sort objects',
    realLifeApplications: ['Counting votes', 'Tracking scores', 'Recording data'],
    crossCurricularLinks: ['Science: recording observations', 'Social Studies: community surveys'],
    weeklyPlacement: 10,
    termPlacement: 1
  }
];

const CAMEROON_PRIMARY_2_TOPICS: TopicItem[] = [
  // SETS AND LOGIC
  {
    id: 'cm-p2-sets-1',
    title: 'Sets and Subsets',
    strand: 'Sets and Logic',
    objectives: [
      'Identify subsets within a larger set',
      'Use Venn diagrams with two sets',
      'Classify objects by multiple attributes'
    ],
    suggestedMaterials: ['Venn diagram charts', 'Objects', 'Counters']
  },
  {
    id: 'cm-p2-sets-2',
    title: 'Arranging Belongings Neatly',
    strand: 'Sets and Logic',
    objectives: [
      'Arrange belongings in an attractive and neat manner',
      'Classify personal items into sets',
      'Show interest in keeping belongings orderly'
    ],
    suggestedMaterials: ['Personal items', 'Storage boxes', 'Labels']
  },
  // NUMBERS AND OPERATIONS
  {
    id: 'cm-p2-num-1',
    title: 'Numbers 0-100',
    strand: 'Numbers and Operations',
    objectives: [
      'Count, read and write numbers up to 100',
      'Recognize number symbols and words',
      'Count forward and backward within 100'
    ],
    suggestedMaterials: ['Number charts (0-100)', 'Flashcards', 'Number line']
  },
  {
    id: 'cm-p2-num-2',
    title: 'Place Value up to 100',
    strand: 'Numbers and Operations',
    objectives: [
      'Understand place value of tens and units',
      'Decompose numbers into tens and units',
      'Compare and order two-digit numbers'
    ],
    suggestedMaterials: ['Place value blocks', 'Abacus', 'Place value charts']
  },
  {
    id: 'cm-p2-num-3',
    title: 'Addition within 100',
    strand: 'Numbers and Operations',
    objectives: [
      'Add two-digit numbers without regrouping',
      'Add two-digit numbers with regrouping',
      'Solve addition word problems'
    ],
    suggestedMaterials: ['Number line', 'Base-ten blocks', 'Worksheets']
  },
  {
    id: 'cm-p2-num-4',
    title: 'Subtraction within 100',
    strand: 'Numbers and Operations',
    objectives: [
      'Subtract two-digit numbers without borrowing',
      'Subtract two-digit numbers with borrowing',
      'Solve subtraction word problems'
    ],
    suggestedMaterials: ['Number line', 'Base-ten blocks', 'Worksheets']
  },
  {
    id: 'cm-p2-num-5',
    title: 'Introduction to Multiplication',
    strand: 'Numbers and Operations',
    objectives: [
      'Understand multiplication as repeated addition',
      'Use objects to show groups of',
      'Multiply using 2s, 5s, and 10s'
    ],
    suggestedMaterials: ['Counters', 'Arrays', 'Multiplication charts']
  },
  {
    id: 'cm-p2-num-6',
    title: 'Introduction to Division',
    strand: 'Numbers and Operations',
    objectives: [
      'Understand division as sharing equally',
      'Divide objects into equal groups',
      'Relate division to multiplication'
    ],
    suggestedMaterials: ['Counters', 'Objects for sharing', 'Pictures']
  },
  {
    id: 'cm-p2-num-7',
    title: 'Skip Counting',
    strand: 'Numbers and Operations',
    objectives: [
      'Skip count by 2s, 5s, and 10s',
      'Identify patterns in skip counting',
      'Use skip counting for multiplication'
    ],
    suggestedMaterials: ['Number line', 'Hundred chart', 'Skip counting songs']
  },
  {
    id: 'cm-p2-num-8',
    title: 'Number Line up to 20',
    strand: 'Numbers and Operations',
    objectives: [
      'Locate points on a number line up to 20',
      'Use number line for addition and subtraction',
      'Compare numbers using the number line'
    ],
    suggestedMaterials: ['Number lines', 'Floor number line', 'Worksheets']
  },
  // MEASUREMENT AND SIZE
  {
    id: 'cm-p2-meas-1',
    title: 'Measurement: Length with Units',
    strand: 'Measurement and Size',
    objectives: [
      'Measure length using standard and non-standard units',
      'Estimate lengths of objects',
      'Compare and order objects by length'
    ],
    suggestedMaterials: ['Rulers', 'Measuring tape', 'String', 'Objects']
  },
  {
    id: 'cm-p2-meas-2',
    title: 'Time: Months of the Year',
    strand: 'Measurement and Size',
    objectives: [
      'Name and order the 12 months of the year',
      'Identify months for special events/holidays',
      'Use calendar to find dates'
    ],
    suggestedMaterials: ['Calendar', 'Month flashcards', 'Birthday chart']
  },
  {
    id: 'cm-p2-meas-3',
    title: 'Time: Reading the Clock',
    strand: 'Measurement and Size',
    objectives: [
      'Read time to the hour on analog clock',
      'Read time to the half hour',
      'Relate time to daily activities'
    ],
    suggestedMaterials: ['Analog clocks', 'Clock worksheets', 'Daily schedule']
  },
  {
    id: 'cm-p2-meas-4',
    title: 'Capacity and Volume',
    strand: 'Measurement and Size',
    objectives: [
      'Compare capacities using litres',
      'Estimate capacity of containers',
      'Measure liquids using standard units'
    ],
    suggestedMaterials: ['Containers', 'Measuring cups', 'Water']
  },
  {
    id: 'cm-p2-meas-5',
    title: 'Money up to 200 FCFA',
    strand: 'Measurement and Size',
    objectives: [
      'Identify and count coins up to 200 FCFA',
      'Add money amounts',
      'Make change in simple transactions'
    ],
    suggestedMaterials: ['Play money', 'Shop role-play', 'Price tags']
  },
  // GEOMETRY AND SPACE
  {
    id: 'cm-p2-geo-1',
    title: '2D Shapes and Properties',
    strand: 'Geometry and Space',
    objectives: [
      'Identify properties of shapes (sides, corners)',
      'Compare and classify 2D shapes',
      'Construct shapes using various materials'
    ],
    suggestedMaterials: ['Geo-boards', 'Shape cut-outs', 'Straws', 'Clay']
  },
  {
    id: 'cm-p2-geo-2',
    title: 'Patterns and Sequences',
    strand: 'Geometry and Space',
    objectives: [
      'Recognize and extend complex patterns',
      'Create patterns using shapes and colours',
      'Identify patterns in numbers'
    ],
    suggestedMaterials: ['Pattern blocks', 'Beads', 'Coloured paper']
  },
  {
    id: 'cm-p2-geo-3',
    title: 'Symmetry in Shapes',
    strand: 'Geometry and Space',
    objectives: [
      'Identify lines of symmetry in shapes',
      'Create symmetrical patterns',
      'Find symmetry in the environment'
    ],
    suggestedMaterials: ['Mirrors', 'Folding paper', 'Symmetry worksheets']
  },
  // GRAPHS AND STATISTICS
  {
    id: 'cm-p2-data-1',
    title: 'Data Collection and Tallying',
    strand: 'Graphs and Statistics',
    objectives: [
      'Collect data through surveys and observation',
      'Record data using tally marks',
      'Organize data in simple tables'
    ],
    suggestedMaterials: ['Survey sheets', 'Tally charts', 'Clipboards']
  },
  {
    id: 'cm-p2-data-2',
    title: 'Simple Bar Graphs',
    strand: 'Graphs and Statistics',
    objectives: [
      'Read and interpret simple bar graphs',
      'Create bar graphs from collected data',
      'Compare quantities using graphs'
    ],
    suggestedMaterials: ['Graph paper', 'Coloured blocks', 'Chart paper']
  },
  {
    id: 'cm-p2-data-3',
    title: 'Ascending and Descending Order',
    strand: 'Graphs and Statistics',
    objectives: [
      'Arrange numbers in ascending order',
      'Arrange numbers in descending order',
      'Rank objects by size or quantity'
    ],
    suggestedMaterials: ['Number cards', 'Objects of various sizes', 'Worksheets']
  }
];

// ==========================================
// NIGERIA CURRICULUM - CLASS-SPECIFIC TOPICS
// ==========================================

const NIGERIA_PRIMARY_1_TOPICS: TopicItem[] = [
  // NUMBER AND NUMERATION
  {
    id: 'ng-p1-num-1',
    title: 'Whole numbers 1-5',
    strand: 'Number and Numeration',
    objectives: [
      'Sort and classify number of objects in a group or collection',
      'Identify number of objects in a group or collection',
      'Count correctly up to 5',
      'Write correctly number 1-5',
      'Arrange numbers 1-5 in order of their magnitudes'
    ],
    subtopics: ['Sorting and classifying objects leading to idea of 1-5', 'Identification of numbers of objects 1-5', 'Reading of number 1-5', 'Writing of numbers 1-5', 'Ordering of number 1-5'],
    suggestedMaterials: ['Counters: stones, beans, bottle tops, buttons, leaves, nylon bags', 'Number cards'],
    teachingMethodology: ['Mix collections and ask pupils to sort by types', 'Guide pupils to form groups for each number', 'Ask pupils to show one bottle top, 2 bottle tops, up to 5', 'Read numbers 1-5', 'Guide pupils to write numbers in order and arrange by magnitude'],
    suggestedActivities: {
      mainActivities: ['Sort objects according to types', 'Sort and classify mixed collection by forming groups', 'Read the numbers 1-5', 'Write the numbers 1-5 in exercise book', 'Use counters to arrange objects in magnitude or ordering form'],
    },
    assessmentMethods: ['Sort given number of objects from a collection', 'Arrange given number of objects from a collection together', 'Read given numbers on board', 'Write numbers 1-5 on the board/exercise book', 'Order given numbers in order of their magnitudes'],
    previousKnowledge: 'Can identify common objects',
    realLifeApplications: ['Sorting items at home', 'Counting family members'],
    weeklyPlacement: 1,
    termPlacement: 1
  },
  {
    id: 'ng-p1-num-2',
    title: 'Whole number 0 (Zero)',
    strand: 'Number and Numeration',
    objectives: [
      'Recognize that the symbol 0 stands for nothingness',
      'Read the number 0',
      'Write 0'
    ],
    subtopics: ['Symbol 0', 'Reading and writing 0', 'Recognizing nothingness'],
    suggestedMaterials: ['Stones', 'Seeds', 'Bottle covers', 'Nylon bags or any other container'],
    teachingMethodology: ['Put stones in bags, leave one bag empty', 'Guide pupils to recognize symbol 0', 'Write number 0', 'Remove objects from each bag until none is left'],
    suggestedActivities: {
      mainActivities: ['Put stones into bags as directed by teacher', 'Remove objects until nothing is left', 'Write and pronounce 0', 'Give examples of zero situations at home'],
    },
    assessmentMethods: ['Remove objects from bags till nothing is left', 'Write and pronounce the number 0', 'Give an example in the home of zero situation'],
    previousKnowledge: 'Can count objects',
    realLifeApplications: ['Recognizing empty containers'],
    weeklyPlacement: 2,
    termPlacement: 1
  },
  {
    id: 'ng-p1-num-3',
    title: 'Whole numbers 6-9',
    strand: 'Number and Numeration',
    objectives: [
      'Sort and classify numbers of objects in a group or collection',
      'Identify number of objects in a group or collection',
      'Count and read correctly from 1-9',
      'Write correctly number 6-9',
      'Arrange the numbers 6-9 in order of their magnitudes'
    ],
    subtopics: ['Sorting and classifying objects leading to idea of 6-9', 'Identification of numbers 6-9', 'Counting and reading numbers 1-9', 'Writing of numbers 6-9', 'Ordering number 6-9'],
    suggestedMaterials: ['Counters: balls, pebbles, buttons, bottle tops, leaves, oranges', 'Flash cards of numbers 1-9'],
    teachingMethodology: ['Guide pupils to mix collection and sort out balls, pebbles, bottle tops, buttons', 'Lead pupils to recognize 6 (5+1), 7, up to 9', 'Guide pupils to read numbers 1-9', 'Guide pupils to write numbers 1-9', 'Arrange numbers in order of magnitude using objects'],
    suggestedActivities: {
      mainActivities: ['Sort and classify mixed collection', 'Identify numbers 6-9 using flash cards', 'Count and read numbers 1-9 on board and flash cards', 'Write the numbers 1-9', 'Use collection of objects to arrange numbers in magnitude or ordering form'],
    },
    assessmentMethods: ['Arrange given number of objects from a collection', 'Identify numbers 6-9', 'Read numbers 1-9 on board and flash cards', 'Write numbers 1-9 on board/exercise book', 'Order numbers 1-9 in their magnitude'],
    previousKnowledge: 'Can count and write numbers 1-5',
    realLifeApplications: ['Counting items in collections'],
    weeklyPlacement: 3,
    termPlacement: 1
  },
  {
    id: 'ng-p1-num-4',
    title: 'Whole number 10 and Place Value',
    strand: 'Number and Numeration',
    objectives: [
      'Recognize 10 as a group',
      'Use idea of place value limited to tens and units'
    ],
    subtopics: ['Recognition of 10 as a group', 'Use of place value - Tens and Units (T, U)'],
    suggestedMaterials: ['Counters: bottle tops, buttons, balls, toes, fingers'],
    teachingMethodology: ['Lead pupils to recognize 10', 'Record number 10 on board', 'Give groups of 11, 12, 13 ... 20 objects to pupils', 'Ask them to group in tens and keep remainder', 'Guide to recognize 11 = 1 ten and 1 unit, etc.'],
    suggestedActivities: {
      mainActivities: ['Sort collection in 8, 9 and 10', 'Recognize number 10', 'Read number 10', 'Write number 10', 'Count 11, 12, 13 up to 20 objects', 'Count values under tens and units (T,U)', 'Write value under T.U.'],
    },
    assessmentMethods: ['Bring ten objects from a collection', 'Read and write 10, 11, 12, 13 up to 20 in T and U'],
    previousKnowledge: 'Can count and write numbers up to 9',
    realLifeApplications: ['Grouping items in tens'],
    weeklyPlacement: 4,
    termPlacement: 1
  },
  {
    id: 'ng-p1-num-5',
    title: 'Whole Numbers 1-99',
    strand: 'Number and Numeration',
    objectives: [
      'Identify and read correctly the numbers 1-99',
      'Write correctly the numbers 1-99'
    ],
    subtopics: ['Identification and reading of numbers 1-99', 'Writing of numbers 1-99'],
    suggestedMaterials: ['Flash cards of numbers'],
    teachingMethodology: ['Use teaching resources to assist pupils identify and read numbers 1-99', 'Guide pupils to write numbers 1-99'],
    suggestedActivities: {
      mainActivities: ['Read numbers 1-99', 'Write numbers 1-99'],
    },
    assessmentMethods: ['Identify and read correctly given numbers between 1-99', 'Write correctly the numbers 1-99'],
    previousKnowledge: 'Can count and write numbers up to 20',
    realLifeApplications: ['Reading numbers in daily life'],
    weeklyPlacement: 5,
    termPlacement: 1
  },
  {
    id: 'ng-p1-num-6',
    title: 'Fractions: Half and Quarter',
    strand: 'Number and Numeration',
    objectives: [
      'Identify 1/2 and 1/4 using concrete objects and shapes'
    ],
    subtopics: ['Identification of 1/2 and 1/4 using concrete objects and shapes'],
    suggestedMaterials: ['Oranges', 'Apples', 'Paper cuttings of shapes: squares, rectangles, circles', 'Coloured pencils', 'Pair of scissors'],
    teachingMethodology: ['Present object as one whole', 'Cut object into two equal parts and explain each part is 1/2', 'Cut object into four equal parts and explain each part is 1/4', 'Ask pupils to colour half and one quarter of shapes in their workbooks'],
    suggestedActivities: {
      mainActivities: ['Practice writing objects into 1/2 and 1/4', 'Match drawings of 1/2 and 1/4 of objects on board', 'Draw whole shapes and their halves and quarters in exercise books', 'Colour 1/2 and 1/4 of shapes in workbooks', 'Give examples of things that can be shared into 1/2 and 1/4'],
    },
    assessmentMethods: ['Cut given oranges into given part', 'Label given drawing of halves and quarters of objects and shapes', 'Fold rectangular or circular shapes into halves and quarters', 'Colour 1/2 and 1/4 of given shapes', 'Give examples of things that can be shared into 1/2 and 1/4'],
    previousKnowledge: 'Can count and identify whole objects',
    realLifeApplications: ['Sharing food equally', 'Dividing items among family members'],
    weeklyPlacement: 6,
    termPlacement: 1
  },
  // BASIC OPERATIONS
  {
    id: 'ng-p1-ops-1',
    title: 'Addition (sums up to 40)',
    strand: 'Basic Operations',
    objectives: [
      'Add two whole numbers from 1 to 3 with sum less than 5',
      'Add two or three whole numbers from 1 to 8 with sum not up to 10',
      'Add two or three numbers from 0 to 9 with sum not greater than 18',
      'Add 2-digit whole numbers with sum not greater than 40 without exchanging or renaming',
      'Cross check numeracy in addition'
    ],
    subtopics: ['Addition of whole numbers with sum less than 5', 'Addition with sum less than 10', 'Addition with sum less than 18', 'Addition of 2-digit numbers with sum not greater than 40'],
    suggestedMaterials: ['Oranges', 'Balls', 'Leaves', 'Bottle tops', 'Number Beads'],
    teachingMethodology: ['Guide pupils to group objects into ones, twos, threes and fours', 'Group objects up to nine for sums less than 10', 'Group objects from 1 to 9 with sum not greater than 18', 'Group objects into tens, elevens, twelve etc. with sum not greater than 40'],
    suggestedActivities: {
      mainActivities: ['Group objects into ones, twos, threes and fours to form sums less than 5', 'Combine two or more similar objects less than 10', 'Combine two or three similar objects less than 18', 'Combine two groups of 2-digit numbers less than 40', 'Crosscheck accuracy in previous addition'],
      applicationTasks: ['Give examples in everyday life where accuracy of addition is needed']
    },
    assessmentMethods: ['Add given whole numbers', 'Add two or three given whole numbers less than 10', 'Add two or three given whole numbers less than 18', 'Add 2-digit numbers and record result', 'Mention three everyday activities where accuracy is necessary'],
    previousKnowledge: 'Can count numbers up to 20',
    realLifeApplications: ['Counting items when shopping', 'Adding scores in games'],
    weeklyPlacement: 7,
    termPlacement: 1
  },
  {
    id: 'ng-p1-ops-2',
    title: 'Subtraction (from numbers not greater than 18)',
    strand: 'Basic Operations',
    objectives: [
      'Subtract from whole numbers not greater than 9',
      'Subtract from whole numbers not greater than 18',
      'Crosscheck accuracy in subtraction'
    ],
    subtopics: ['Subtraction from whole numbers not greater than 9', 'Subtraction from whole numbers not greater than 18'],
    suggestedMaterials: ['Stones', 'Oranges', 'Bean seeds', 'Balls', 'Bottle tops', 'Number Beads'],
    teachingMethodology: ['Guide pupils to group objects e.g. oranges into 1-9', 'Lead pupils to take away a lesser number from the group', 'Guide pupils to group objects into sets of 18, 17...', 'Lead pupils to count and take away a lesser number from the group'],
    suggestedActivities: {
      mainActivities: ['Group objects such as oranges into 1-9', 'Count one given group of objects and remove a lesser number', 'Group objects such as bean seeds into 18, 17, 16...', 'Give examples of everyday life where accuracy in subtraction is needed'],
    },
    assessmentMethods: ['Subtract given whole numbers not greater than 9', 'Subtract given whole numbers not greater than 18', 'Mention two examples of everyday activities where accuracy in subtraction is needed'],
    previousKnowledge: 'Can count numbers and perform addition',
    realLifeApplications: ['Spending money', 'Sharing items'],
    weeklyPlacement: 8,
    termPlacement: 1
  },
  {
    id: 'ng-p1-ops-3',
    title: 'Addition - Finding Missing Numbers',
    strand: 'Basic Operations',
    objectives: [
      'Find missing numbers in a statement',
      'Cross-check the correctness of addition in everyday life'
    ],
    subtopics: ['Finding missing numbers e.g. 8 + __ = 9, 7 + __ = 9, 5 + __ = 8'],
    suggestedMaterials: ['Pebbles', 'Oranges', 'Balls', 'Bottle tops', 'Number Beads'],
    teachingMethodology: ['Guide pupils to take a set of objects and constitute two groups of known unequal numbers', 'Guide pupils to determine number of objects to be added to obtain the bigger group'],
    suggestedActivities: {
      mainActivities: ['Group one object into two of unequal numbers', 'Count the number of objects in group and determine number to be added', 'Cross-check accuracy in addition in everyday activities'],
    },
    assessmentMethods: ['Find missing numbers in a given statement', 'Mention four areas where accuracy of addition is required in daily life'],
    previousKnowledge: 'Can perform basic addition',
    realLifeApplications: ['Completing groups of items', 'Making up amounts'],
    weeklyPlacement: 9,
    termPlacement: 1
  },
  {
    id: 'ng-p1-ops-4',
    title: 'Subtraction - Finding Missing Numbers',
    strand: 'Basic Operations',
    objectives: [
      'Find missing numbers in a subtraction statement',
      'Cross-check the correctness of subtraction in everyday life'
    ],
    subtopics: ['Finding missing numbers e.g. 8 - __ = 4, 7 - __ = 5, 5 - __ = 3'],
    suggestedMaterials: ['Pebbles', 'Oranges', 'Balls', 'Bottle tops', 'Number Beads'],
    teachingMethodology: ['Guide pupils to take a set of objects and constitute two groups of known unequal numbers', 'Guide pupils to determine the number to be subtracted from the bigger group'],
    suggestedActivities: {
      mainActivities: ['Group one object into two of unequal numbers', 'Count the number of objects and determine the number to be subtracted', 'Give examples of activities requiring accuracy of subtraction'],
    },
    assessmentMethods: ['Find missing numbers in a given statement', 'Mention four areas where accuracy of subtraction is required in daily life'],
    previousKnowledge: 'Can perform basic subtraction',
    realLifeApplications: ['Change when buying items', 'Items left after sharing'],
    weeklyPlacement: 10,
    termPlacement: 1
  },
  // ALGEBRAIC PROCESSES
  {
    id: 'ng-p1-alg-1',
    title: 'Open Sentences',
    strand: 'Algebraic Processes',
    objectives: [
      'Find missing numbers in an open sentence',
      'Solve simple related open sentences'
    ],
    subtopics: ['Open sentences e.g. 1 + __ = 3, 2 + __ = 5'],
    suggestedMaterials: ['Bottle tops', 'Number cards', 'Dot cards', 'Pupils themselves'],
    teachingMethodology: ['Guide pupils to find missing numbers in examples', 'Guide pupils to solve simple open sentences'],
    suggestedActivities: {
      mainActivities: ['Solve series of problems involving open sentences', 'Solve simple related open sentences'],
    },
    assessmentMethods: ['Solve given problems on open sentences', 'Find simple numbers in open sentences'],
    previousKnowledge: 'Can perform basic addition and subtraction',
    realLifeApplications: ['Problem solving in daily activities'],
    weeklyPlacement: 11,
    termPlacement: 1
  },
  // MENSURATION AND GEOMETRY - PRIMARY MEASURES
  {
    id: 'ng-p1-meas-1',
    title: 'Money: Nigerian Coins',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Recognize different denominations of Nigerian coins',
      'Add coins to obtain sums not exceeding 25k',
      'Calculate change obtainable from 10k or less',
      'Trace coins using brown and white papers'
    ],
    subtopics: ['Nigerian coins 25k, 10k, 5k, 1k, and 1/2k', 'Sum of two or three coins', 'Shopping with a 10k piece and receiving change', 'Tracing of coins'],
    suggestedMaterials: ['Actual coins', 'Model coins or paper coins', 'Tracing paper', 'Brown paper', 'White paper', 'Crayon'],
    teachingMethodology: ['Lead pupils through activities to recognize different denominations', 'Devise suitable games for recognizing coins', 'Use flash cards to show addition of coins', 'Guide pupils in practical buying and selling', 'Trace various denominations of coins'],
    suggestedActivities: {
      mainActivities: ['Engage in sorting of coins into various denominations', 'Identify the different denominations', 'Practice addition with sum not exceeding 25k', 'Buy and sell from class shopping corner', 'Trace different Nigerian coins as demonstrated'],
    },
    assessmentMethods: ['Given a collection of coins, identify some as specified', 'Do simple exercise on addition of money not exceeding 25k', 'Calculate change when buying or selling something by a simple game', 'Trace any given coin'],
    previousKnowledge: 'Can count numbers up to 20',
    realLifeApplications: ['Buying items at school', 'Saving coins', 'Making change'],
    weeklyPlacement: 12,
    termPlacement: 1
  },
  {
    id: 'ng-p1-meas-2',
    title: 'Length: Comparison and Natural Units',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Develop the idea of length',
      'Compare length of two or three objects',
      'Order similar objects according to lengths',
      'Measure length and distance in natural units',
      'Apply the length and ordering of lengths in our environment'
    ],
    subtopics: ['Idea of length', 'Comparison of length using "longer than" and "shorter than"', 'Ordering of lengths of objects', 'Measuring of length using natural units such as hand span, steps, arms length, strides', 'Measuring and ordering of length'],
    suggestedMaterials: ['Pencils', 'Sticks', 'Desk', 'Strings', 'The classroom', 'Pupils themselves'],
    teachingMethodology: ['Direct pupil to move from one point to another using steps', 'Ask pupils to measure table with hand span', 'Use strides across classroom', 'Guide pupils to measure with arm length', 'Guide pupils to arrange objects by length'],
    suggestedActivities: {
      mainActivities: ['Observe the pupil move in the class', 'Measure table with hand span', 'Move from one corner to another', 'Compare two pencils of different lengths', 'Arrange objects in order of lengths', 'Measure and order given objects by length'],
    },
    assessmentMethods: ['Give examples of lengths', 'Measure given lengths with steps, hand spans, strides and foot', 'Compare lengths using "longer than" and "shorter than"', 'Order given bundles of sticks of various length', 'Measure different given lengths using different natural units'],
    previousKnowledge: 'Can identify and compare objects',
    realLifeApplications: ['Measuring distances at home', 'Comparing sizes of objects'],
    weeklyPlacement: 13,
    termPlacement: 1
  },
  {
    id: 'ng-p1-meas-3',
    title: 'Time: Concept and Daily Events',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Demonstrate knowledge of the idea of time',
      'Mention when certain things are done at home and school'
    ],
    subtopics: ['Introduction of the idea of time', 'Time when certain things are done: Morning, Afternoon, Evening, Night', 'Time and events when certain activities take place'],
    suggestedMaterials: ['Charts indicating activities peculiar to different periods of the day'],
    teachingMethodology: ['Guide pupils to state when things are done at home and school'],
    suggestedActivities: {
      mainActivities: ['State the time when certain things are done e.g. sleep, go to school', 'State when some events take place at home and school', 'Play a drama on time and events to do certain activities'],
    },
    assessmentMethods: ['State the time of sleeping', 'State the time of coming to school'],
    previousKnowledge: 'Knows daily routines at home',
    realLifeApplications: ['Daily scheduling', 'School routines'],
    weeklyPlacement: 14,
    termPlacement: 1
  },
  {
    id: 'ng-p1-meas-4',
    title: 'Weight: Comparing Light and Heavy',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Compare the weights of some common objects in the school using the terms light and heavy'
    ],
    subtopics: ['Lifting objects', 'Estimating and comparing their weights'],
    suggestedMaterials: ['Weight balance', 'See-saw'],
    teachingMethodology: ['Guide the pupils to lift two different objects to compare their weights'],
    suggestedActivities: {
      mainActivities: ['Lift two different objects and say which one is light and heavy'],
    },
    assessmentMethods: ['Show two different objects and select which one is heavier than the other'],
    previousKnowledge: 'Can identify and handle objects',
    realLifeApplications: ['Comparing weights of items at home', 'Choosing items to carry'],
    weeklyPlacement: 15,
    termPlacement: 1
  },
  // MENSURATION AND GEOMETRY - SHAPES
  {
    id: 'ng-p1-geo-1',
    title: 'Three Dimensional Shapes',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Sort out cubes, cuboids, cylinders and spheres',
      'Identify and name cuboids, cubes, cylinders and spheres',
      'Distinguish between cuboids and cubes',
      'Mention solid shapes in homes and environment'
    ],
    subtopics: ['Cubes, cuboids, cylinders and spheres'],
    suggestedMaterials: ['Ludo dice', 'Match boxes', 'Empty packets of sugar', 'Empty tins of Milo, milk', 'Balls of different sizes', 'Charts showing pictures of Cuboids, Cubes, Cylinders, Spheres'],
    teachingMethodology: ['Guide pupils to sort objects according to shapes', 'Lead pupils to identify and name the sorted solids', 'Guide pupils to distinguish between cuboids and cubes', 'Lead pupils to mention solid shapes in homes and environment'],
    suggestedActivities: {
      mainActivities: ['Sort out objects (solids) according to shapes', 'Identify and name the stored solids', 'Distinguish between cuboids and cubes', 'Mention solid shapes in their homes and environment'],
    },
    assessmentMethods: ['Sort out different solids according to their shapes', 'Identify and name different solids', 'Distinguish between given cuboids and cubes', 'Give examples of solid shapes in their homes and environment'],
    previousKnowledge: 'Can identify common objects',
    realLifeApplications: ['Recognizing shapes in everyday objects', 'Building and construction awareness'],
    weeklyPlacement: 16,
    termPlacement: 1
  },
  {
    id: 'ng-p1-geo-2',
    title: 'Two Dimensional Shapes',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Identify a Square, a Rectangle and a Circle',
      'Match and name a square, a rectangle and a Circle',
      'Distinguish between squares and rectangles',
      'Mention square, rectangular and circular shapes in homes'
    ],
    subtopics: ['Squares, Rectangles and Circles'],
    suggestedMaterials: ['Shape drawings and cut-outs of squares, rectangles, circles', 'Empty tins of bournvita, milk', 'Empty packets of sugar, chalk'],
    teachingMethodology: ['Guide pupils to mention groups of objects with similar flat faces', 'Lead pupils to discover distinguishing features of square, rectangle and circle', 'Guide pupils to mention square, rectangular, circular shapes in their homes'],
    suggestedActivities: {
      mainActivities: ['Group objects with similar flat faces', 'Discover distinguishing features of square, rectangle and circle', 'Mention the square, rectangular and circular shapes in their homes'],
    },
    assessmentMethods: ['Match a given flat face with name: square, rectangle, circle', 'Distinguish between given square and rectangle', 'Name three square, rectangular and circular shapes in their homes'],
    previousKnowledge: 'Can identify and sort objects by attributes',
    realLifeApplications: ['Recognizing flat shapes in buildings, books, etc.'],
    weeklyPlacement: 17,
    termPlacement: 1
  },
  // EVERYDAY STATISTICS
  {
    id: 'ng-p1-data-1',
    title: 'Data Collection: Ages and Heights',
    strand: 'Everyday Statistics',
    objectives: [
      'Collect data on their ages at home and school',
      'Collect data on their heights'
    ],
    subtopics: ['Data collection on ages of pupils', 'Data collection on heights of pupils'],
    suggestedMaterials: ['Pupils themselves', 'Cards with ages written', 'Wall rule'],
    teachingMethodology: ['Guide pupils to mention their ages', 'Lead pupils to measure their heights'],
    suggestedActivities: {
      mainActivities: ['Measure their ages', 'Measure their heights', 'Group themselves according to their ages and heights'],
    },
    assessmentMethods: ['Group themselves according to their ages and heights', 'Mention their ages/heights'],
    previousKnowledge: 'Can count and compare numbers',
    realLifeApplications: ['Knowing own age and height', 'Comparing with classmates'],
    weeklyPlacement: 18,
    termPlacement: 1
  }
];

const NIGERIA_PRIMARY_2_TOPICS: TopicItem[] = [
  // NUMBER AND NUMERATION
  {
    id: 'ng-p2-num-1',
    title: 'Whole numbers 1-200',
    strand: 'Number and Numeration',
    objectives: [
      'Count numbers correctly from 1-200',
      'Identify and read numbers from 1-200',
      'Identify order and write numbers up to 200'
    ],
    subtopics: ['Counting of numbers from 1-200', 'Identification and reading of numbers from 1-200', 'Introduction of place value of a number', 'Ordering of numbers up to 200', 'Writing numbers up to 200'],
    suggestedMaterials: ['Concrete objects: bottle tops, sticks, seeds, small waterproof bags for bundles', 'Ropes', 'Straws', 'Two hundred square charts', 'Flash cards', 'Charts of numbers 1-200'],
    teachingMethodology: ['Revise counting from 1-99 using counters and 100-square charts', 'Add one counter to 99 counters', 'Count numbers 1 to 200', 'Build up piles in tens and units', 'Demonstrate place value', 'Order given piles of numbers', 'Write numbers up to 200'],
    suggestedActivities: {
      mainActivities: ['Revise counting from 1-99', 'Layout bottle tops in rows and columns of ten up to 100', 'Count from 1 to 200', 'Identify and read numbers from 1-200', 'Build up piles to correspond with given number', 'Write number in expanded form and use to find place value', 'Order given piles of numbers', 'Write numbers up to 200'],
    },
    assessmentMethods: ['Arrange and count correctly using bottle tops in tens up to two hundreds', 'Count bundles of straw in tens and hundreds up to two hundreds', 'Build piles corresponding to given numbers', 'Identify and read given numbers on flash cards', 'Write given numbers in expanded form', 'Order given piles of numbers', 'Write numbers up to 200'],
    previousKnowledge: 'Can count and write numbers 1-99',
    realLifeApplications: ['Counting larger quantities at home', 'Reading page numbers in books'],
    weeklyPlacement: 1,
    termPlacement: 1
  },
  {
    id: 'ng-p2-num-2',
    title: 'Fractions: 1/2, 1/4 and 3/4',
    strand: 'Number and Numeration',
    objectives: [
      'Divide a collection of concrete objects into two equal parts and four equal parts',
      'Obtain 3/4 of a concrete object'
    ],
    subtopics: ['1/2 and 1/4 of any given collection', '3/4 of any given collection'],
    suggestedMaterials: ['Oranges', 'Cardboard papers'],
    teachingMethodology: ['Guide pupils to divide objects into two equal parts and four equal parts', 'Guide pupils to divide objects into four equal parts to obtain three quarters', 'Guide pupils to fold cardboard papers to get four parts and shade three parts'],
    suggestedActivities: {
      mainActivities: ['Divide objects into two equal parts and four equal parts', 'Divide objects into four equal parts to obtain three-quarters', 'Fold cardboard papers to get four parts and shade the three parts'],
    },
    assessmentMethods: ['Find 1/2 and 1/4 of given collections of objects', 'Find 3/4 of given collections of objects'],
    previousKnowledge: 'Knows the concept of half and quarter from Primary 1',
    realLifeApplications: ['Sharing food in equal parts', 'Dividing items among groups'],
    weeklyPlacement: 2,
    termPlacement: 1
  },
  // BASIC OPERATIONS
  {
    id: 'ng-p2-ops-1',
    title: 'Addition (2 and 3-digit numbers)',
    strand: 'Basic Operations',
    objectives: [
      'Add 2-digit numbers without exchanging or renaming',
      'Add 3-digit numbers without exchanging or renaming',
      'Add 2-digit numbers with exchanging or renaming',
      'Add 3 numbers taking two at a time'
    ],
    subtopics: ['Revision of addition of 2-digit numbers without exchanging', 'Addition of 3-digit numbers without exchanging', 'Addition of 2-digit numbers with exchanging or renaming', 'Addition of 3 numbers taking two at a time'],
    suggestedMaterials: ['Number Beads', 'Bean seeds', 'Cards', 'Charts on addition of 3-digit numbers', 'Counters such as sticks and bottle tops', 'Addition cards'],
    teachingMethodology: ['Revise addition of 2-digit numbers without exchanging', 'Guide pupils to solve addition problems of 3-digit numbers', 'Lead pupils to arrange counters in bundles of tens and write e.g. 35 sticks = 3 bundles and 5 pieces', 'Guide pupils on verbal addition using flash cards'],
    suggestedActivities: {
      mainActivities: ['Revise addition of 2-digit numbers without exchanging', 'Solve addition of 3-digit numbers such as 141 + 125', 'Arrange counters in bundles of tens and units', 'Count and say numbers in expanded form: 96 = 9 tens + 6 units', 'Add given 2-digit number on the board', 'Solve verbal addition contained in addition cards'],
    },
    assessmentMethods: ['Add given 2-digit numbers without exchanging', 'Add 3-digit numbers vertically without exchanging', 'Add 2-digit numbers with exchanging and renaming', 'Add 3 given numbers taking two at a time'],
    previousKnowledge: 'Can add 2-digit numbers',
    realLifeApplications: ['Adding prices when shopping', 'Counting larger groups of items'],
    weeklyPlacement: 3,
    termPlacement: 1
  },
  {
    id: 'ng-p2-ops-2',
    title: 'Subtraction (2-digit numbers)',
    strand: 'Basic Operations',
    objectives: [
      'Subtract 2-digit numbers without exchanging or renaming',
      'Subtract 2-digit numbers with exchanging and renaming',
      'Apply addition and subtraction in everyday activities'
    ],
    subtopics: ['Subtraction of 2-digit numbers without exchanging', 'Subtraction of 2-digit numbers with exchanging or renaming'],
    suggestedMaterials: ['Number cards', 'Cardboard strips with numerals and number line', 'Number Beads', 'Sticks', 'Counters: Oranges, Bean seeds, Bottle tops'],
    teachingMethodology: ['Revise subtraction of 1-digit numbers', 'Lead pupils to identify number of tens and write in 2-digit numbers', 'Guide pupils in use of counters to demonstrate subtraction as taking away', 'Lead pupils to give examples of everyday activities where accuracy is required'],
    suggestedActivities: {
      mainActivities: ['Solve quick problems on subtraction of 1-digit numbers', 'Practice expressing place values', 'Give answers to given problems using counters', 'Mention the digits in tens and units in expanded form', 'Give examples of everyday activities where accuracy is required'],
    },
    assessmentMethods: ['Subtract 2-digit numbers without exchanging', 'Subtract 2-digit numbers with exchanging and renaming', 'Mention 4 everyday activities where accuracy is needed'],
    previousKnowledge: 'Can subtract 1-digit numbers',
    realLifeApplications: ['Making change when shopping', 'Finding remaining quantities'],
    weeklyPlacement: 4,
    termPlacement: 1
  },
  {
    id: 'ng-p2-ops-3',
    title: 'Multiplication as Repeated Addition',
    strand: 'Basic Operations',
    objectives: [
      'Multiply numbers using repeated additions',
      'Apply correctness in multiplications as important in everyday activities'
    ],
    subtopics: ['Multiplication as repeated addition and use of symbol "x"'],
    suggestedMaterials: ['Number cards', 'Cardboard strips with numerals and number line', 'Number Beads', 'Sticks', 'Counters: Oranges, Bean seeds, Bottle tops'],
    teachingMethodology: ['Use counters to demonstrate multiplication as repeated additions e.g. 2+2+2=6 and 4+4=8', 'Guide pupils to use symbol "x" for multiplication', 'Emphasize correct multiplication as important in everyday activities', 'Guide pupils to give examples of everyday activities where multiplication is necessary'],
    suggestedActivities: {
      mainActivities: ['Use counters to carry out multiplication as repeated addition', 'Use the symbol "x" in multiplication', 'Apply the value of multiplications in everyday activities', 'Give examples of daily activities where multiplication is necessary'],
    },
    assessmentMethods: ['Multiply the given numbers using repeated addition', 'Mention some everyday activities that require accurate multiplication'],
    previousKnowledge: 'Can perform addition and recognizes groups of objects',
    realLifeApplications: ['Calculating total cost of multiple items', 'Counting in groups'],
    weeklyPlacement: 5,
    termPlacement: 1
  },
  // ALGEBRAIC PROCESSES
  {
    id: 'ng-p2-alg-1',
    title: 'Open Sentences',
    strand: 'Algebraic Processes',
    objectives: [
      'Find missing numbers in an open sentence',
      'Solve simple related quantitative aptitude problems'
    ],
    subtopics: ['Open sentences e.g. 2 + __ = 5, 6 - __ = 3'],
    suggestedMaterials: ['Bottle tops', 'Number cards', 'Dot cards', 'Pupils themselves'],
    teachingMethodology: ['Guide pupils to find missing numbers', 'Guide pupils to solve simple related quantitative aptitude problems'],
    suggestedActivities: {
      mainActivities: ['Solve series of problems involving open sentences', 'Solve simple related quantitative aptitude problems'],
    },
    assessmentMethods: ['Solve given problems on open sentences', 'Find missing numbers in simple related quantitative aptitude problems'],
    previousKnowledge: 'Can perform addition and subtraction',
    realLifeApplications: ['Problem solving in daily activities'],
    weeklyPlacement: 6,
    termPlacement: 1
  },
  // MENSURATION AND GEOMETRY
  {
    id: 'ng-p2-meas-1',
    title: 'Money: Nigerian Coins and Bank Notes',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Enumerate the uses of money',
      'Recognize all types of Nigerian coins and bank notes',
      'Change money up to N20 into small units and shop with money not greater than N20'
    ],
    subtopics: ['Uses of money', 'Nigerian coins and bank notes', 'Changing units of money e.g. 10k coins = 10k piece; N5 = 5 x N1.00'],
    suggestedMaterials: ['Nigerian coins and bank notes', 'Chart of coins and bank notes', 'Various articles with price tag less than N5'],
    teachingMethodology: ['Guide pupils to list the various uses of money', 'Guide pupils to recognize and identify Nigerian coins and bank notes', 'Bring articles to class with price tags not more than N20', 'Guide pupils to shop in the class'],
    suggestedActivities: {
      mainActivities: ['Mention the uses of money', 'Recognize and identify Nigerian coins and bank notes', 'Change money up to N20 into small units and shop with money not greater than N20'],
    },
    assessmentMethods: ['List various uses of money', 'Recognize and identify given Nigeria coins and bank notes', 'Collect correct change from buying an article from the class shop'],
    previousKnowledge: 'Recognizes Nigerian coins from Primary 1',
    realLifeApplications: ['Shopping with parents', 'Making change', 'Saving money'],
    weeklyPlacement: 7,
    termPlacement: 1
  },
  {
    id: 'ng-p2-meas-2',
    title: 'Length: Metres and Centimetres',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Compare their natural units with another e.g. arm\'s length',
      'Identify the differences in arm\'s length and other parts of body used for measurement',
      'Use metres and centimetres as standard measuring units',
      'Identify the need for lengths and measurement using standardized units'
    ],
    subtopics: ['Comparing natural units of groups of lengths', 'Measurement in metres and centimetres'],
    suggestedMaterials: ['The classroom', 'Pupils themselves', 'Metre rule', '30cm ruler'],
    teachingMethodology: ['Guide pupils to measure length of classroom with foot and arms length', 'Lead pupils to find out difference in arms length and other body measurement', 'Guide pupils to use metre rule to measure objects', 'Emphasize importance of standard unit'],
    suggestedActivities: {
      mainActivities: ['Measure length of classroom with foot and arms length', 'Identify difference in arms length and other non-standard measures', 'Use metre rule to measure some objects in the class', 'Note importance of standard unit over natural units'],
    },
    assessmentMethods: ['Measure width of classroom with foot and arm\'s length', 'Measure width of classroom with rule', 'Explain the value of standardized unit of measure'],
    previousKnowledge: 'Can compare lengths using natural units',
    realLifeApplications: ['Measuring distances', 'Understanding standard measurements'],
    weeklyPlacement: 8,
    termPlacement: 1
  },
  {
    id: 'ng-p2-meas-3',
    title: 'Time: Clock and Days of the Week',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Give time to the hour and half',
      'Name and arrange days of the week'
    ],
    subtopics: ['Reading clocks to the hour and half hour', 'Naming days of the week and arranging them in order'],
    suggestedMaterials: ['Real clocks', 'Cardboard clocks', 'Dummy Clock', 'Calendars', 'Table of days of the week'],
    teachingMethodology: ['Explain the long and short hands of the clock', 'Lead pupils to relate half hour to half of the clock face', 'Writes a given time on the board', 'Guide pupils to name the days of the week', 'Lead pupils to arrange and learn days in order from Sunday to Saturday'],
    suggestedActivities: {
      mainActivities: ['Say the time as shown on clocks', 'Write given time in exercise books', 'Name the days of the week', 'Arrange and learn days of the week in order from Sunday to Saturday'],
    },
    assessmentMethods: ['Say the time on a given cardboard clock', 'Write the time of a given diagram on board/exercise book', 'Name the days of week', 'Name the day before and after a given day'],
    previousKnowledge: 'Has basic understanding of time periods from Primary 1',
    realLifeApplications: ['Reading the clock at home', 'Planning daily activities'],
    weeklyPlacement: 9,
    termPlacement: 1
  },
  {
    id: 'ng-p2-meas-4',
    title: 'Weight: Ordering Objects',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Order objects according to their weights'
    ],
    subtopics: ['Comparison and ordering of objects by weight'],
    suggestedMaterials: ['Stones', 'Oranges', 'Coconut', 'Improvised scale', 'Bathroom scale', 'Strings', 'Length of sticks', 'See-saw'],
    teachingMethodology: ['Guide pupils in comparing weights of objects using hand balancing, improvised scale, bathroom scale', 'Obtain weights of different pupils using see-saw and bathroom scales', 'Arrange objects/pupils weights to determine which is heavier'],
    suggestedActivities: {
      mainActivities: ['Compare weights of objects using hand balancing, improvised scale, bathroom scale and see-saw', 'Arrange objects/pupils weights to determine which is heavier'],
    },
    assessmentMethods: ['Compare the weights of two given objects and determine which is heavier'],
    previousKnowledge: 'Can compare light and heavy objects from Primary 1',
    realLifeApplications: ['Comparing weights of items when shopping'],
    weeklyPlacement: 10,
    termPlacement: 1
  },
  {
    id: 'ng-p2-meas-5',
    title: 'Capacity: Measuring and Ordering Containers',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Identify and name objects that could be used for measuring capacity',
      'Order containers based on their capacities'
    ],
    subtopics: ['Identifying and naming objects for measuring capacity: cups, empty containers, buckets', 'Ordering of containers based on their capacities'],
    suggestedMaterials: ['Cups', 'Buckets', 'Empty containers', 'Tins'],
    teachingMethodology: ['Guide pupils to say uses of empty containers and emphasize use for measuring', 'Guide pupils to measure into different containers of different sizes with a small container', 'Guide pupils to arrange containers by number of times small container was measured'],
    suggestedActivities: {
      mainActivities: ['Say the uses of each container', 'Measure and note number of times in each case', 'Arrange containers according to number of times small container was measured'],
    },
    assessmentMethods: ['Use a small cup to measure water into a container and say how many cups fill it', 'Order given containers based on capacities'],
    previousKnowledge: 'Can compare sizes of containers',
    realLifeApplications: ['Measuring water for cooking', 'Comparing container sizes at home'],
    weeklyPlacement: 11,
    termPlacement: 1
  },
  {
    id: 'ng-p2-meas-6',
    title: 'Area: Comparing Surfaces',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Compare areas of surfaces',
      'Identify the use of standard measuring units'
    ],
    subtopics: ['Areas of different objects: rectangles, squares, triangles, circles and other surfaces', 'The idea of larger than, smaller than, largest, smallest and the same'],
    suggestedMaterials: ['Plane shapes (square and rectangles etc.)'],
    teachingMethodology: ['Guide pupils to compare areas of different surfaces', 'Lead pupils to appreciate standard measuring units'],
    suggestedActivities: {
      mainActivities: ['Compare areas of different surfaces', 'Identify the use of standard measuring units'],
    },
    assessmentMethods: ['Compare areas of given surfaces'],
    previousKnowledge: 'Can compare lengths and sizes of objects',
    realLifeApplications: ['Comparing sizes of fields and buildings'],
    weeklyPlacement: 12,
    termPlacement: 1
  },
  // GEOMETRY - SHAPES
  {
    id: 'ng-p2-geo-1',
    title: 'Three Dimensional Shapes: Properties',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Identify and count the flat faces of a cube and a cuboid',
      'Identify and count the corners of a cube and a cuboid',
      'Identify and count the edges of a cube and cuboid',
      'Identify objects at home that are cuboids and cubes',
      'Identify the curved surfaces of a cylinder',
      'Mention three dimensional objects in their homes that are cylinders and spheres'
    ],
    subtopics: ['Properties of a cube and a cuboid: Faces, Corners, Edges', 'Properties of a Cylinder and a sphere: Curved surface'],
    suggestedMaterials: ['Boxes', 'Tins', 'Balls', 'Paper cuttings and drawing of cubes and cuboids', 'Balls', 'Milk tin', 'Paper cuttings and drawings'],
    teachingMethodology: ['Guide pupils to identify and count faces, corners and edges of cuboid and cube', 'Lead pupils to mention objects at home that are cuboids and cubes', 'Guide pupils to identify flat curved surfaces of cylinder and sphere', 'Lead pupils to mention differences between flat faces and curved surfaces'],
    suggestedActivities: {
      mainActivities: ['Identify and count the faces, corners and edges of cuboids and cube', 'Copy the board summary', 'Mention objects at home that are cuboids and cubes', 'Identify flat faces and curved surfaces of cylinder and sphere', 'Mention differences between flat faces and curved surfaces', 'Mention objects at home that are cylinders and spheres'],
    },
    assessmentMethods: ['Identify cuboids and cubes from a given collection', 'Count faces, corners and edges of a given cube and cuboid', 'Mention three objects each that are cuboids and cubes', 'Complete a chart indicating faces, corners, edges and curved surfaces of cube, cuboid, cylinder and sphere', 'Mention six three dimensional objects each in home that are cylinders and spheres'],
    previousKnowledge: 'Can identify and name basic 3D shapes from Primary 1',
    realLifeApplications: ['Identifying shapes in everyday objects and packaging'],
    weeklyPlacement: 13,
    termPlacement: 1
  },
  {
    id: 'ng-p2-geo-2',
    title: 'Two Dimensional Shapes and Square Corners',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Identify a square, a rectangle, a circle and a triangle',
      'Indicate which corner of a 2-dimensional shape is a "square corner"'
    ],
    subtopics: ['Identification of shapes: Square, Rectangle, Circle, Triangle', '"Square corners" in shapes'],
    suggestedMaterials: ['Cubes', 'Match boxes', 'Tins', 'Paper cuttings and drawings of squares, rectangles, triangles, circles'],
    teachingMethodology: ['Bring shapes to class', 'Lead pupils to identify square and rectangular faces of cubes and cuboids', 'Lead pupils to draw triangles by joining three non-collinear points', 'Guide pupils to discover "square corners" in cubes, cuboids, squares and rectangles'],
    suggestedActivities: {
      mainActivities: ['Identify square and rectangular faces of cubes and cuboids', 'Draw triangles by joining three non-collinear points', 'Identify that triangle has three sides and three corners', 'Discover corners that are "square corners"', 'Discover that square or rectangle has four square corners', 'Discover that some triangles have only one square corner while others have none'],
    },
    assessmentMethods: ['Identify objects with square, rectangular and circular faces', 'Draw different types of triangles in exercise books', 'Match given shapes with names', 'Identify "square corners" of a given cube, cuboid, square, rectangle or triangle'],
    previousKnowledge: 'Can identify squares, rectangles and circles from Primary 1',
    realLifeApplications: ['Recognizing shapes in architecture, art, and design'],
    weeklyPlacement: 14,
    termPlacement: 1
  },
  // EVERYDAY STATISTICS
  {
    id: 'ng-p2-data-1',
    title: 'Data Collection and Arrays',
    strand: 'Everyday Statistics',
    objectives: [
      'Collect data and arrange them in arrays',
      'Collect data and arrange them in groups such as groups of boys and girls'
    ],
    subtopics: ['Collecting data and arranging them in arrays', 'Collecting data and arranging them in groups'],
    suggestedMaterials: ['Pupils themselves', 'Cards with ages', 'Wall rule'],
    teachingMethodology: ['Guide pupils to collect data and arrange them in arrays', 'Arrange them in groups such as group of boys and group of girls'],
    suggestedActivities: {
      mainActivities: ['Collect data and arrange them in arrays', 'Collect data and arrange them in groups'],
    },
    assessmentMethods: ['Arrange the numbers in order', 'Group the numbers in order'],
    previousKnowledge: 'Can collect and organize simple data from Primary 1',
    realLifeApplications: ['Organizing class data', 'Sorting information'],
    weeklyPlacement: 15,
    termPlacement: 1
  }
];

const NIGERIA_PRIMARY_3_TOPICS: TopicItem[] = [
  // NUMBER AND NUMERATION
  {
    id: 'ng-p3-num-1',
    title: 'Whole numbers up to 999',
    strand: 'Number and Numeration',
    objectives: [
      'Count correctly numbers up to 999',
      'State the place value of a digit in a 3-digit number',
      'Order whole numbers and use the symbols < and >',
      'Mention the need for counting and ordering'
    ],
    subtopics: ['Correct counting of numbers up to 999', 'Counting in groups of Hundreds, Tens, and Units (H.T.U.)', 'Ordering whole numbers with symbols < and >'],
    suggestedMaterials: ['Match sticks', 'Bottle tops', 'Seeds', 'Rope', 'Rubber band', 'Pebbles', 'Charts of written whole numbers', 'Place value chart', 'Counters', 'Abacus', 'Inequality chart', 'Elbow sign'],
    teachingMethodology: ['Guide pupils to prepare piles or bundles in hundreds, tens and units', 'Guide pupils to count up to 999', 'Guide pupils to expand a given number e.g. 432 = 400 + 30 + 2', 'Guide pupils to compare two whole numbers using place value procedure', 'Lead pupils to mention importance of counting and ordering'],
    suggestedActivities: {
      mainActivities: ['Prepare piles or bundles of given collection in hundreds, tens and units', 'Count up to 999', 'Identify and read out numbers up to 999', 'Prepare a collection of counters in hundreds, tens and units', 'Count numbers in hundreds, tens and units', 'Expand and present whole numbers in H.T.U.', 'Compare given numbers using symbols < and >', 'Mention need for counting and ordering in everyday activities'],
    },
    assessmentMethods: ['Count objects in hundreds, tens and units', 'Identify and read out given numbers up to 999', 'State the place value of a digit in a given whole number', 'Order pairs of 3-digit numbers using < and > symbols'],
    previousKnowledge: 'Can count and write numbers up to 200',
    realLifeApplications: ['Counting larger items', 'Reading prices above 200 Naira', 'Understanding population numbers'],
    weeklyPlacement: 1,
    termPlacement: 1
  },
  {
    id: 'ng-p3-num-2',
    title: 'Fractions: 1/2, 1/3, 1/4, 1/5, 1/6 and equivalent fractions',
    strand: 'Number and Numeration',
    objectives: [
      'State fraction of a group of concrete objects',
      'Divide shapes into 1/2, 1/3, 1/4 etc.',
      'Write fractions which have the same value as a given fraction',
      'Use the symbol < or > to order fractions'
    ],
    subtopics: ['Fractions (1/2, 1/3, 1/4, 1/5, 1/6)', 'Fractions of shapes: squares, circle, rectangle and triangle', 'Equivalent fractions', 'Ordering of fractions'],
    suggestedMaterials: ['Concrete objects', 'Counters', 'Paper cut outs in shapes of square, circle, rectangle, triangle', 'Papers of equal sizes', 'Markers', 'Coloured pencils or crayon', 'Inequality chart'],
    teachingMethodology: ['Guide pupils to divide a given number into parts without remainder', 'Guide pupils to divide shapes into given number of parts', 'Guide pupils to match division with corresponding fraction', 'Guide pupils to discover that 1/2 = 2/4 = 3/6 = 4/8', 'Guide pupils to use 2 pieces of paper of same size to demonstrate equivalent fractions', 'Lead pupils to identify which fraction is less than or greater than another'],
    suggestedActivities: {
      mainActivities: ['Divide a set of objects into various fractions (1/2, 1/3, 1/4, 1/5, 1/6)', 'Divide shapes into given number of parts', 'Match division of sets with fractions', 'Divide different set of objects to discover 1/2 = 2/4 = 3/6 = 4/8', 'Divide, colour and match the marked paper', 'Identify which fraction is less than or greater than the other'],
    },
    assessmentMethods: ['Divide a given set of objects into 1/2, 1/3, 1/4, 1/5', 'Divide given shapes into fractions', 'Divide given set of objects to form required equivalent fractions', 'Order given set of fractions using < or >'],
    previousKnowledge: 'Knows 1/2, 1/4 and 3/4 from Primary 2',
    realLifeApplications: ['Dividing food into equal parts', 'Sharing items equally among groups'],
    weeklyPlacement: 2,
    termPlacement: 1
  },
  // BASIC OPERATIONS
  {
    id: 'ng-p3-ops-1',
    title: 'Addition (2 and 3-digit with exchanging, fractions)',
    strand: 'Basic Operations',
    objectives: [
      'Add 2-digit numbers with exchanging or renaming',
      'Add 3-digit numbers',
      'Add 3 numbers taking two at a time',
      'Add fractions with the same denominator',
      'Mention the need for correct addition of numbers and fractions in everyday activities'
    ],
    subtopics: ['Addition of 2-digit numbers with exchanging', 'Addition of 3-digit numbers', 'Addition of 3 numbers taking two at a time', 'Addition of fractions with the same denominator'],
    suggestedMaterials: ['Charts and flash cards', 'Addition cards', 'Fraction card', 'Fraction board', 'Counters', 'Charts', 'Abacus'],
    teachingMethodology: ['Guide pupils to arrange counters in bundles of tens', 'Guide pupils in solving addition problems involving 2-digit numbers', 'Guide pupils to add two numbers with 3-digits that involve exchanging', 'Guide pupils on use of abacus', 'Guide pupils to identify fractions with same denominator', 'Guide pupils to add fractions having the same denominator'],
    suggestedActivities: {
      mainActivities: ['Arrange counters in bundles of tens and units', 'Count and say numbers in expanded form', 'Add given 2-digit numbers on the board', 'Add two numbers with 3-digits that involve renaming or exchanging', 'Use abacus to perform addition of 3-digit numbers', 'Respond to oral addition', 'Use fraction board to bring out fractions with same denominator', 'Add fractions with same denominator', 'Give examples of daily activities requiring correct additions'],
    },
    assessmentMethods: ['Add 2-digit numbers with exchanging and renaming', 'Add two given 3-digit numbers with exchanging', 'Add two numbers with 3-digits using abacus', 'Add 3 given numbers taking two at a time', 'Add given fractions with the same denominator', 'Give three examples of everyday activities that demand accuracy of addition'],
    previousKnowledge: 'Can add 2 and 3-digit numbers without exchanging',
    realLifeApplications: ['Adding up shopping totals', 'Combining scores', 'Sharing and combining groups'],
    weeklyPlacement: 3,
    termPlacement: 1
  },
  {
    id: 'ng-p3-ops-2',
    title: 'Subtraction (2 and 3-digit with exchanging, fractions)',
    strand: 'Basic Operations',
    objectives: [
      'Subtract 2-digit numbers with exchanging or renaming',
      'Subtract 3-digit numbers',
      'Subtract 3 numbers taking two at a time',
      'Subtract fractions with the same denominator',
      'Mention the need for correct subtraction in everyday activities'
    ],
    subtopics: ['Subtraction of 2-digit numbers with exchanging', 'Subtraction of 3-digit numbers', 'Subtraction of 3 numbers taking two at a time', 'Subtraction of fractions with the same denominator'],
    suggestedMaterials: ['Counters: stones, sticks, bottle tops', 'Charts', 'Abacus', 'Subtraction cards', 'Fraction board', 'Flash cards'],
    teachingMethodology: ['Guide pupils to arrange counters in bundles of tens', 'Guide pupils in solving subtraction problems involving 2-digit numbers', 'Guide pupils to subtract two numbers with 3-digits that involve exchanging', 'Guide pupils to use abacus to subtract 3-digit numbers', 'Guide pupils to subtract fractions with same denominators using fraction board'],
    suggestedActivities: {
      mainActivities: ['Arrange counters in bundles of tens and units', 'Count and express numbers in expanded form', 'Subtract given 2-digit numbers', 'Identify tens and units in given numbers', 'Subtract two numbers with 3-digits involving renaming or exchanging', 'Use abacus to subtract 3-digit numbers', 'Identify fractions with same denominators', 'Subtract fractions with same denominators', 'Give examples of daily activities requiring correct subtraction'],
    },
    assessmentMethods: ['Subtract 2-digit numbers with exchanging and renaming', 'Subtract two given 3-digit numbers with exchanging or renaming'],
    previousKnowledge: 'Can subtract 2-digit numbers without exchanging',
    realLifeApplications: ['Making change when shopping', 'Finding difference between quantities'],
    weeklyPlacement: 4,
    termPlacement: 1
  },
  {
    id: 'ng-p3-ops-3',
    title: 'Multiplication (1x1 to 9x9, 2-digit by 1-digit)',
    strand: 'Basic Operations',
    objectives: [
      'Multiply from 1x1 to 9x9',
      'Multiply 2-digit number by 1-digit number',
      'Multiply three 1-digit numbers taking two at a time',
      'Carry out correct multiplication in everyday activities'
    ],
    subtopics: ['Basic multiplication from 1x1 to 9x9', 'Multiplication of 2-digit number by 1-digit', 'Multiplication of three 1-digit numbers taking two at a time'],
    suggestedMaterials: ['10x10 Square chart', 'Multiplication table', 'Chart showing multiplication of 2-digit by 1-digit', 'Multiplications chart for three 1-digit numbers'],
    teachingMethodology: ['Guide pupils in use of square charts to carry out multiplication 1x1 to 9x9', 'Guide pupils to use repeated addition for multiplication', 'Guide pupils to use multiplication chart for 2-digit by 1-digit', 'Guide pupils to multiply three 1-digit numbers taking two at a time'],
    suggestedActivities: {
      mainActivities: ['Use square charts and multiplication tables 1x1 to 9x9', 'Carry out multiplication of 2-digit by 1-digit using repeated addition', 'Practice multiplication of 2-digit by 1-digit horizontally and vertically', 'Carry out multiplication of three 1-digit numbers taking two at a time', 'Give examples of everyday activities requiring correct multiplication'],
    },
    assessmentMethods: ['Carry out given multiplications from 1x1 to 9x9', 'Multiply given 2-digit number by 1-digit number', 'Multiply 2-digit number by 1-digit vertically or horizontally', 'Multiply given three 1-digit numbers taking two at a time', 'Give examples of everyday activities requiring correct multiplications'],
    previousKnowledge: 'Understands multiplication as repeated addition from Primary 2',
    realLifeApplications: ['Calculating total cost of multiple items', 'Multiplying in trade and commerce', 'Counting groups of items'],
    weeklyPlacement: 5,
    termPlacement: 1
  },
  {
    id: 'ng-p3-ops-4',
    title: 'Division (whole numbers up to 48, factors and multiples)',
    strand: 'Basic Operations',
    objectives: [
      'Divide whole numbers not exceeding 48 by 2, 3, 4, 5 and 6 without remainder',
      'Express whole numbers not exceeding 48 as products of factors',
      'Find a missing factor in a given number',
      'Distinguish between factors and multiples',
      'Carry out correct division in everyday activities'
    ],
    subtopics: ['Division of whole numbers not exceeding 48 by 2, 3, 4, 5 and 6', 'Factors of Whole numbers not exceeding 48', 'Finding a missing factor in a given number', 'Factors and multiples of numbers'],
    suggestedMaterials: ['Counters', 'Charts containing divisions not exceeding 48', 'Charts of factors of whole numbers', 'Rectangular pattern of numbers', 'Charts containing worked examples'],
    teachingMethodology: ['Guide pupils through division of whole numbers such as 20/5 or 20÷5', 'Lead pupils to divide by grouping and repeated subtraction', 'Guide pupils to express whole numbers as products of factors', 'Guide pupils to use rectangular pattern of numbers to find factors', 'Guide pupils to write out multiples of a given number', 'Lead pupils to distinguish between factors and multiples'],
    suggestedActivities: {
      mainActivities: ['Divide whole numbers not exceeding 48 by 2, 3, 4, 5, 6', 'Solve division problems using grouping and repeated subtractions', 'Use rectangular pattern of numbers to find factors', 'Work problems involving finding missing factors', 'Distinguish between factors and multiples', 'Give instances of everyday activities demanding accurate division'],
    },
    assessmentMethods: ['Divide whole numbers not exceeding 48 by 2,3,4,5 and 6 by grouping and repeated subtractions', 'Express given whole numbers not exceeding 48 as products of factors', 'Construct rectangular pattern to find factors', 'Find missing factor of a given number', 'Distinguish between factors and multiples', 'Give examples of everyday activities requiring correct divisions'],
    previousKnowledge: 'Can multiply and understands grouping',
    realLifeApplications: ['Sharing items equally among friends', 'Dividing food into equal portions', 'Splitting costs among people'],
    weeklyPlacement: 6,
    termPlacement: 1
  },
  // ALGEBRAIC PROCESSES
  {
    id: 'ng-p3-alg-1',
    title: 'Open Sentences',
    strand: 'Algebraic Processes',
    objectives: [
      'Find missing number in an open sentence',
      'Identify the relationship between addition and subtraction',
      'Solve related quantitative aptitude problems'
    ],
    subtopics: ['Open sentences e.g. 9 + __ = 15, 18 - __ = 7'],
    suggestedMaterials: ['Chart containing worked examples on open sentences'],
    teachingMethodology: ['Guide pupils to find missing numbers', 'Lead pupils to appreciate relationship between + and -', 'Guide pupils to solve quantitative aptitude problems on open sentences'],
    suggestedActivities: {
      mainActivities: ['Solve series of problems involving open sentences', 'Give examples of open sentences in everyday life', 'Solve related quantitative aptitude problems'],
    },
    assessmentMethods: ['Solve given problems on open sentences', 'Find missing numbers in quantitative aptitude diagrams'],
    previousKnowledge: 'Can solve simple open sentences from Primary 2',
    realLifeApplications: ['Problem solving in daily activities'],
    weeklyPlacement: 7,
    termPlacement: 1
  },
  // MENSURATION AND GEOMETRY
  {
    id: 'ng-p3-meas-1',
    title: 'Money: Change, Shopping and Multiplication',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Change money not exceeding N20 into smaller units',
      'Shop effectively with money not greater than N20 using addition and subtraction',
      'Perform simple multiplication involving money with product not exceeding N20'
    ],
    subtopics: ['Changing money not exceeding N20 into smaller units', 'Shopping involving addition and subtraction with money not greater than N20', 'Multiplication involving money with product not exceeding N20'],
    suggestedMaterials: ['Real money', 'Models Money', 'Empty tins of milk, Geisha, Bournvita', 'Empty packets of sugar, Lipton', 'Empty packets of matches', 'Addition cards'],
    teachingMethodology: ['Guide pupils to realize exchange rates between denominations', 'Give pupils N50k and ask to change it into 10k coins', 'Set up shopping corner with items priced not more than N20', 'Appoint shopkeeper and customer roles', 'Guide pupils to solve problems on addition and subtraction of money', 'Do mental skills on multiplication of simple numbers'],
    suggestedActivities: {
      mainActivities: ['Participate in changing money into smaller units not exceeding N20', 'Collect items for shopping corner', 'Act as shopkeeper or customer', 'Respond to mental skill on multiplications', 'Solve problems on multiplication involving money'],
    },
    assessmentMethods: ['Say how many of a given smaller denomination are contained in a bigger denomination such as N20', 'Do given exercises on addition and subtraction of money', 'Solve given problems on multiplication involving money with products not exceeding N20'],
    previousKnowledge: 'Can recognize and use Nigerian coins and bank notes',
    realLifeApplications: ['Shopping with parents', 'Making correct change', 'Budgeting'],
    weeklyPlacement: 8,
    termPlacement: 1
  },
  {
    id: 'ng-p3-meas-2',
    title: 'Length: Perimeter of Regular Figures',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Measure the length and/or width of room, table, building and straight edged materials',
      'Mention importance/benefits of standard units of measurement',
      'Find perimeters of regular figures in metres and centimetres by measurement',
      'Identify perimeter of regular shapes in their environment'
    ],
    subtopics: ['Measure of lengths, widths and comparison of estimates with actual measurement using steps and hand span', 'Measuring and finding the perimeter of regular figures in metres and centimetres'],
    suggestedMaterials: ['Ropes', 'Tapes', 'Rulers', 'Desks', 'Tables', 'Hand span of the pupil', 'Cut-outs of squares, rectangles, triangles'],
    teachingMethodology: ['Guide pupils to measure their table using hand spans', 'Record their results in tabular form', 'Estimate length of various objects', 'Guide pupils to measure length using standard units', 'Ask pupils to measure two lengths and two widths of their tables', 'Guide pupils to measure all distances around regular figures and record results', 'Lead pupils to find that distance round a plane object is called perimeter'],
    suggestedActivities: {
      mainActivities: ['Measure their table using hand spans', 'Estimate length of various objects in the class', 'Measure length of given objects using standard units', 'Measure the two lengths and two widths of their tables', 'Measure regular figures and record all distances round', 'Find the perimeter of plane shapes in the environment'],
    },
    assessmentMethods: ['Measure given objects using hand spans and standard units', 'Find perimeters of given figures by measurement'],
    previousKnowledge: 'Can measure using natural units and metre rule',
    realLifeApplications: ['Measuring rooms at home', 'Fencing a garden', 'Measuring sports field boundaries'],
    weeklyPlacement: 9,
    termPlacement: 1
  },
  {
    id: 'ng-p3-meas-3',
    title: 'Length: Standard Units in Context',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Compare non-standard measures e.g. arms length',
      'Identify differences in non-standard measures',
      'Use metres and centimetres as standard measuring units',
      'Identify the need for lengths and measurement using standardized units'
    ],
    subtopics: ['Comparing non standard measures e.g. arms length', 'Measurement in metres and centimetres'],
    suggestedMaterials: ['The classroom', 'Arms length', 'Foot', 'Other non-standard measures', 'Metre rule', '30cm ruler', 'Biro', 'Pencil'],
    teachingMethodology: ['Ask pupils to measure classroom with foot and arms length', 'Lead pupils to find out difference in arms length and other non-standard measures', 'Guide pupils to use metre rule to measure objects', 'Emphasize importance of standard unit over natural units'],
    suggestedActivities: {
      mainActivities: ['Measure length and width of classroom with foot and arms length', 'Find difference in arms length and other non-standard measures', 'Use metre rule to measure objects in the class', 'Note importance of standard units over natural units'],
    },
    assessmentMethods: ['Measure length and width of classroom with foot and arms length', 'Measure length and width of classroom using standard measuring units', 'Explain the value of standardized unit of measure'],
    previousKnowledge: 'Can use metre rule and knows arms length measurement',
    realLifeApplications: ['Understanding why we use standard measurements'],
    weeklyPlacement: 10,
    termPlacement: 1
  },
  {
    id: 'ng-p3-meas-4',
    title: 'Time: Hours, Minutes and Calendar',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Say time accurately in hours and minutes',
      'Give dates in day and month',
      'Mention the importance of time in daily life activities'
    ],
    subtopics: ['Time on the clock', 'Calendar reading of the days of the months, year and reading of dates'],
    suggestedMaterials: ['Clock charts', 'Real clock', 'Calendars'],
    teachingMethodology: ['Use clock chart to demonstrate how to tell time', 'Lead pupils to state time in minutes, hours, "half past" and "quarter to"', 'Design activities for pupils to state time in hours and minutes', 'Display calendar and guide pupils to say dates and when certain events are celebrated', 'Lead pupils to identify use of time and dates in daily life'],
    suggestedActivities: {
      mainActivities: ['State time in minutes, hours, "half past" and "quarter to"', 'Participate in activities for stating time in hours and minutes', 'Study the calendar and say when certain events are celebrated', 'Identify the use of time and date in daily life'],
    },
    assessmentMethods: ['Work exercises on how to tell time in minutes and hours', 'Draw clock faces to show different times', 'Read calendar and state the date of a particular event in Nigeria', 'Say the number of days in every given month and number of months in any given year'],
    previousKnowledge: 'Can read time to the hour and half hour',
    realLifeApplications: ['Being punctual', 'Planning daily schedule', 'Reading timetables'],
    weeklyPlacement: 11,
    termPlacement: 1
  },
  {
    id: 'ng-p3-meas-5',
    title: 'Weight: Grams and Kilograms',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Measure weights of objects in grams and kilograms',
      'Make meaningful comparison of weight of objects like rocks and minerals',
      'Appreciate the need for grams and kilogram as standard units for transactions'
    ],
    subtopics: ['Introduction of grams and kilograms as units of measurement', 'Weights of some rocks and minerals'],
    suggestedMaterials: ['A scale or balance', 'Tins of milk and tomatoes puree', 'Block of stones', 'Packets of sugar', 'Large tin of bournvita', 'Samples of different rocks and minerals'],
    teachingMethodology: ['Guide pupils to obtain the weight of some objects', 'Explain that weight of small objects like packets of sugar are in grams while heavy objects like stones are in kilograms', 'Guide pupils to obtain weights of rocks and minerals', 'Lead pupils to apply grams and kilograms as standard units for transactions'],
    suggestedActivities: {
      mainActivities: ['Obtain weight of some objects', 'Note that weight of small objects is in grams and heavy objects in kilograms', 'Weigh some rocks and minerals samples', 'Apply grams and kilograms as standard unit for transactions'],
    },
    assessmentMethods: ['Weigh selected objects and make a chart of results', 'Give examples of objects whose weights could be expressed in grams and kilograms', 'Determine weight of given rocks and minerals and explain those expressed in kilograms and grams'],
    previousKnowledge: 'Can compare and order objects by weight',
    realLifeApplications: ['Weighing food for cooking', 'Buying items by weight at the market'],
    weeklyPlacement: 12,
    termPlacement: 1
  },
  {
    id: 'ng-p3-meas-6',
    title: 'Capacity: Litres',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Identify litre as a unit of measuring capacity',
      'Measure liquid e.g. water using a graduated cylinder up to any stated number of litres',
      'Identify the need for accuracy in measuring liquids'
    ],
    subtopics: ['Identifying litre as a unit of measuring capacity', 'Measuring liquid with graduated cylinder up to any stated number of litres'],
    suggestedMaterials: ['Empty used syringes', 'Bottles', 'Graduated cylinder', 'Empty containers', 'Water'],
    teachingMethodology: ['Guide pupils to learn: 10ml = 1cl, 10cl = 1dl, 10dl = 1 litre, 1000 litres = 1 kilolitre', 'Lead pupils to identify litre as unit of measurement for capacity', 'Guide pupils to measure into graduated cylinder', 'Guide pupils to identify need for accuracy in measuring liquids'],
    suggestedActivities: {
      mainActivities: ['Study and copy given information on units of litres', 'Identify litre as measure of capacity', 'Measure into graduated cylinder and calculate number needed to fill a container', 'Identify need for accuracy in measuring liquids'],
    },
    assessmentMethods: ['Say how many millilitres and decilitres make 1 litre', 'Measure out four litres of water with a graduated cylinder'],
    previousKnowledge: 'Can identify and order containers by capacity',
    realLifeApplications: ['Measuring water, kerosene, petrol', 'Cooking and measuring ingredients'],
    weeklyPlacement: 13,
    termPlacement: 1
  },
  // GEOMETRY - SHAPES
  {
    id: 'ng-p3-geo-1',
    title: 'Symmetry, Properties of Shapes, Straight Lines and Curves',
    strand: 'Mensuration and Geometry',
    objectives: [
      'Identify shapes with line(s) of symmetry',
      'Identify lines of symmetry in everyday life',
      'State properties of squares, rectangles and triangles',
      'Distinguish between curves and straight lines',
      'Identify presence of straight lines and curves in real life',
      'Draw squares, rectangles, triangles and circles'
    ],
    subtopics: ['Line(s) of symmetry', 'Properties of squares, rectangles, triangles', 'Curves and straight lines', 'Drawing of squares, rectangles, triangles and circles'],
    suggestedMaterials: ['Plane shapes', 'Leaves', 'Pictures', 'Squares', 'Rectangles', 'Triangles', 'Cut-outs', 'Ruler', 'Pencil', 'Broomsticks', 'Straight edges', 'Square cornered shapes', 'Circular tins', 'Coins'],
    teachingMethodology: ['Guide pupils to identify lines of symmetry by folding plane shapes', 'Lead pupils to identify lines of symmetry in everyday life', 'Guide pupils to identify properties of squares, rectangles and triangles', 'Guide pupils to draw straight lines and curves', 'Lead pupils to explain differences between curve and straight line', 'Guide pupils to draw squares, rectangles, triangles and circles using rulers'],
    suggestedActivities: {
      mainActivities: ['Identify lines of symmetry by folding given plane shapes', 'Identify lines of symmetry in everyday life', 'Identify properties of squares, rectangles and triangles', 'Identify various shapes in our environment', 'Draw straight lines and curves', 'Mention differences between a curve and a straight line', 'Draw squares, rectangles, triangles and circles', 'Mention types of triangles'],
    },
    assessmentMethods: ['Verify whether or not given plane shapes have lines of symmetry', 'Find the number of lines of symmetry in each given plane shape', 'State relationship between sides and angles of square, rectangle and triangle', 'State important properties of squares, rectangles and triangles', 'Explain difference between straight line and curve', 'Draw and label square, rectangle, triangle and circle', 'Explain differences between equilateral, isosceles and right-angled triangles'],
    previousKnowledge: 'Can identify and name 2D and 3D shapes',
    realLifeApplications: ['Recognizing symmetry in nature and art', 'Drawing and design', 'Architecture'],
    weeklyPlacement: 14,
    termPlacement: 1
  },
  // EVERYDAY STATISTICS
  {
    id: 'ng-p3-data-1',
    title: 'Pictograms',
    strand: 'Everyday Statistics',
    objectives: [
      'Read and represent information in pictograms using vertical and horizontal arrangements',
      'Represent information on a pictogram',
      'Identify the most common features of pictogram (the mode)',
      'Mention the usefulness of pictogram (the mode)'
    ],
    subtopics: ['Pictograms', 'Pictogram mode'],
    suggestedMaterials: ['Cardboard of pictograms arranged vertically and horizontally', 'Cut outs of pictures for pictograms', 'Pictograms with one mode', 'Data from environmental topics'],
    teachingMethodology: ['Guide pupils to represent information in a pictogram', 'Guide pupils to represent information involving everyday life in a pictogram', 'Guide pupils to find the mode in a pictogram', 'Lead pupils to mention usefulness and applications of mode in real life'],
    suggestedActivities: {
      mainActivities: ['Represent information in a pictogram', 'Represent information involving everyday life in a pictogram', 'Find the mode in a pictogram', 'Mention usefulness and applications of mode in real life'],
    },
    assessmentMethods: ['Represent given information on a pictogram', 'Give three examples of life situations where pictograms can be applied', 'Find the mode on a given pictogram', 'State the mode of an information or event within environment'],
    previousKnowledge: 'Can collect data and arrange in arrays from Primary 2',
    realLifeApplications: ['Reading charts in newspapers', 'Understanding data displays', 'Presenting survey results'],
    weeklyPlacement: 15,
    termPlacement: 1
  }
];

// Master curriculum data organized by country and class level
const CLASS_CURRICULUM: Record<string, Record<string, TopicItem[]>> = {
  cameroon: {
    'Primary 1': CAMEROON_PRIMARY_1_TOPICS,
    'Primary 2': CAMEROON_PRIMARY_2_TOPICS,
    'Primary 3': [],
    'Primary 4': [],
    'Primary 5': [],
    'Primary 6': []
  },
  nigeria: {
    'Primary 1': NIGERIA_PRIMARY_1_TOPICS,
    'Primary 2': NIGERIA_PRIMARY_2_TOPICS,
    'Primary 3': NIGERIA_PRIMARY_3_TOPICS,
    'Primary 4': [],
    'Primary 5': [],
    'Primary 6': []
  }
};

/**
 * Get topics for a specific country and class level
 */
export function getTopicsForClassLevel(country: string, classLevel: string): TopicItem[] {
  const normalizedCountry = country.toLowerCase();
  const countryTopics = CLASS_CURRICULUM[normalizedCountry];
  
  if (!countryTopics) {
    console.warn(`No curriculum found for country: ${country}`);
    return [];
  }
  
  const topics = countryTopics[classLevel];
  
  if (!topics || topics.length === 0) {
    console.warn(`No topics found for ${country} ${classLevel}`);
    return [];
  }
  
  return topics;
}

/**
 * Get unique strands (categories) for a class level
 */
export function getStrandsForClassLevel(country: string, classLevel: string): string[] {
  const topics = getTopicsForClassLevel(country, classLevel);
  const strands = new Set(topics.map(t => t.strand));
  return Array.from(strands);
}

/**
 * Get topics filtered by strand
 */
export function getTopicsByStrand(country: string, classLevel: string, strand: string): TopicItem[] {
  const topics = getTopicsForClassLevel(country, classLevel);
  return topics.filter(t => t.strand === strand);
}

/**
 * Get a specific topic by ID
 */
export function getTopicById(topicId: string): TopicItem | undefined {
  for (const country of Object.keys(CLASS_CURRICULUM)) {
    for (const classLevel of Object.keys(CLASS_CURRICULUM[country])) {
      const topic = CLASS_CURRICULUM[country][classLevel].find(t => t.id === topicId);
      if (topic) return topic;
    }
  }
  return undefined;
}

// Fallback curriculum content (in-memory)
const FALLBACK_CURRICULUM: Record<string, CurriculumContent> = {
  nigeria: {
    country: 'Nigeria',
    level: 'Primary',
    subject: 'Mathematics',
    description: 'Nigerian National Mathematics Curriculum for Primary Schools',
    topics: [
      {
        title: 'Number and Numeration',
        objectives: [
          'Understand place value and notation',
          'Perform basic arithmetic operations',
          'Work with fractions and decimals'
        ],
        subtopics: ['Whole numbers', 'Fractions', 'Decimals', 'Percentages']
      },
      {
        title: 'Basic Operations',
        objectives: [
          'Master addition and subtraction',
          'Perform multiplication and division',
          'Apply operations to solve problems'
        ],
        subtopics: ['Addition', 'Subtraction', 'Multiplication', 'Division']
      },
      {
        title: 'Measurement',
        objectives: [
          'Measure length, mass, and capacity',
          'Understanding time and money',
          'Apply measurement in real contexts'
        ],
        subtopics: ['Length', 'Mass', 'Capacity', 'Time', 'Money']
      },
      {
        title: 'Geometry',
        objectives: [
          'Identify 2D and 3D shapes',
          'Understand properties of shapes',
          'Apply geometric concepts'
        ],
        subtopics: ['2D shapes', '3D shapes', 'Angles', 'Symmetry']
      }
    ]
  },
  cameroon: {
    country: 'Cameroon',
    level: 'Primary',
    subject: 'Mathematics',
    description: 'Cameroonian National Mathematics Curriculum for Primary Schools',
    topics: [
      {
        title: 'Numération',
        objectives: [
          'Comprendre la valeur de position',
          'Effectuer des opérations de base',
          'Travailler avec les fractions'
        ],
        subtopics: ['Nombres entiers', 'Fractions', 'Décimaux']
      },
      {
        title: 'Opérations de base',
        objectives: [
          'Maîtriser l\'addition et la soustraction',
          'Effectuer la multiplication et la division',
          'Résoudre des problèmes'
        ],
        subtopics: ['Addition', 'Soustraction', 'Multiplication', 'Division']
      },
      {
        title: 'Mesure',
        objectives: [
          'Mesurer la longueur, la masse et la capacité',
          'Comprendre le temps et l\'argent',
          'Appliquer les mesures'
        ],
        subtopics: ['Longueur', 'Masse', 'Capacité', 'Temps', 'Argent']
      },
      {
        title: 'Géométrie',
        objectives: [
          'Identifier les formes 2D et 3D',
          'Comprendre les propriétés',
          'Appliquer les concepts géométriques'
        ],
        subtopics: ['Formes 2D', 'Formes 3D', 'Angles', 'Symétrie']
      }
    ]
  }
};

/**
 * Get curriculum content synchronously (fallback)
 */
export function getCurriculumContent(country: string): CurriculumContent {
  const normalizedCountry = country.toLowerCase();
  return FALLBACK_CURRICULUM[normalizedCountry] || FALLBACK_CURRICULUM.nigeria;
}

/**
 * Load curriculum content from JSON file asynchronously
 */
export async function getCurriculumContentAsync(country: string): Promise<CurriculumContent> {
  try {
    const normalizedCountry = country.toLowerCase();
    const response = await fetch(`/content/curriculum-level-one-math.json`);
    
    if (!response.ok) {
      console.warn('Failed to load curriculum JSON, using fallback');
      return getCurriculumContent(normalizedCountry);
    }
    
    const data = await response.json();
    
    // If JSON has country-specific data, return it
    if (data[normalizedCountry]) {
      return data[normalizedCountry];
    }
    
    // If JSON is the curriculum data itself
    if (data.country && data.topics) {
      return data;
    }
    
    // Fallback to in-memory data
    return getCurriculumContent(normalizedCountry);
  } catch (error) {
    console.error('Error loading curriculum:', error);
    return getCurriculumContent(country);
  }
}

/**
 * Get default class level for a country
 */
export function getDefaultClassLevel(country: string): string {
  const normalizedCountry = country.toLowerCase();
  const levels = CLASS_LEVELS[normalizedCountry as keyof typeof CLASS_LEVELS];
  return levels ? levels[0] : 'Primary 1';
}

/**
 * Get all class levels for a country
 */
export function getClassLevelsForCountry(country: string): string[] {
  const normalizedCountry = country.toLowerCase();
  return CLASS_LEVELS[normalizedCountry as keyof typeof CLASS_LEVELS] || CLASS_LEVELS.nigeria;
}

/**
 * Format curriculum content for AI prompt
 */
export function formatCurriculumForPrompt(curriculum: CurriculumContent): string {
  if (!curriculum || !curriculum.topics) {
    return '';
  }

  let formatted = `Curriculum Context: ${curriculum.description}\n\n`;
  formatted += `Subject: ${curriculum.subject}\n`;
  formatted += `Level: ${curriculum.level}\n\n`;
  formatted += `Key Topics:\n`;

  curriculum.topics.forEach((topic, index) => {
    formatted += `\n${index + 1}. ${topic.title}\n`;
    
    if (topic.objectives && topic.objectives.length > 0) {
      formatted += `   Learning Objectives:\n`;
      topic.objectives.forEach(obj => {
        formatted += `   - ${obj}\n`;
      });
    }
    
    if (topic.subtopics && topic.subtopics.length > 0) {
      formatted += `   Subtopics: ${topic.subtopics.join(', ')}\n`;
    }
  });

  return formatted;
}

/**
 * Format a selected topic's FULL curriculum context for AI prompt
 * This includes teaching methodology, activities, assessment, and more
 */
export function formatSelectedTopicForPrompt(topic: TopicItem, classLevel: string, country: string): string {
  if (!topic) return '';

  const countryName = country === 'nigeria' ? 'Nigerian' : 'Cameroonian';
  
  let context = `
=== OFFICIAL ${countryName.toUpperCase()} CURRICULUM ALIGNMENT ===

TOPIC: ${topic.title}
STRAND/CATEGORY: ${topic.strand}
CLASS LEVEL: ${classLevel}
${topic.weeklyPlacement ? `SCHEME OF WORK POSITION: Week ${topic.weeklyPlacement}, Term ${topic.termPlacement || 1}` : ''}

--- LEARNING OBJECTIVES ---
Learners should be able to:
${topic.objectives.map((obj, i) => `${i + 1}. ${obj}`).join('\n')}
`;

  if (topic.subtopics && topic.subtopics.length > 0) {
    context += `
--- SUBTOPICS TO COVER ---
${topic.subtopics.map(st => `• ${st}`).join('\n')}
`;
  }

  if (topic.previousKnowledge) {
    context += `
--- PREVIOUS KNOWLEDGE (PRE-REQUISITES) ---
${topic.previousKnowledge}
`;
  }

  if (topic.suggestedMaterials && topic.suggestedMaterials.length > 0) {
    context += `
--- TEACHING AIDS/MATERIALS ---
${topic.suggestedMaterials.join(', ')}
`;
  }

  if (topic.teachingMethodology && topic.teachingMethodology.length > 0) {
    context += `
--- TEACHING METHODOLOGY ---
${topic.teachingMethodology.map(m => `• ${m}`).join('\n')}
`;
  }

  if (topic.suggestedActivities) {
    context += `
--- SUGGESTED LEARNING ACTIVITIES ---`;
    
    if (topic.suggestedActivities.warmUp && topic.suggestedActivities.warmUp.length > 0) {
      context += `
Warm-Up Activities:
${topic.suggestedActivities.warmUp.map(a => `  • ${a}`).join('\n')}`;
    }
    
    if (topic.suggestedActivities.mainActivities && topic.suggestedActivities.mainActivities.length > 0) {
      context += `
Main Teaching Activities:
${topic.suggestedActivities.mainActivities.map(a => `  • ${a}`).join('\n')}`;
    }
    
    if (topic.suggestedActivities.practicalTasks && topic.suggestedActivities.practicalTasks.length > 0) {
      context += `
Practical Tasks:
${topic.suggestedActivities.practicalTasks.map(a => `  • ${a}`).join('\n')}`;
    }
    
    if (topic.suggestedActivities.applicationTasks && topic.suggestedActivities.applicationTasks.length > 0) {
      context += `
Application Tasks (Real-World):
${topic.suggestedActivities.applicationTasks.map(a => `  • ${a}`).join('\n')}`;
    }
    context += '\n';
  }

  if (topic.assessmentMethods && topic.assessmentMethods.length > 0) {
    context += `
--- ASSESSMENT METHODS ---
${topic.assessmentMethods.map(a => `• ${a}`).join('\n')}
`;
  }

  if (topic.remediationStrategies && topic.remediationStrategies.length > 0) {
    context += `
--- REMEDIATION STRATEGIES (For Struggling Learners) ---
${topic.remediationStrategies.map(r => `• ${r}`).join('\n')}
`;
  }

  if (topic.extensionActivities && topic.extensionActivities.length > 0) {
    context += `
--- EXTENSION ACTIVITIES (For Advanced Learners) ---
${topic.extensionActivities.map(e => `• ${e}`).join('\n')}
`;
  }

  if (topic.realLifeApplications && topic.realLifeApplications.length > 0) {
    context += `
--- REAL-LIFE APPLICATIONS ---
${topic.realLifeApplications.map(r => `• ${r}`).join('\n')}
`;
  }

  if (topic.crossCurricularLinks && topic.crossCurricularLinks.length > 0) {
    context += `
--- CROSS-CURRICULAR INTEGRATION ---
${topic.crossCurricularLinks.map(c => `• ${c}`).join('\n')}
`;
  }

  context += `
=== END OF CURRICULUM ALIGNMENT ===

IMPORTANT INSTRUCTIONS FOR LESSON PLAN GENERATION:
1. The lesson plan MUST strictly follow this curriculum alignment
2. Use the EXACT learning objectives stated above
3. Incorporate the suggested activities and teaching methodology
4. Include materials from the teaching aids list
5. Design assessment based on the assessment methods provided
6. Create practical homework assignments using the real-life applications
7. For the INTRODUCTION phase: Connect to the stated previous knowledge
8. For the PRESENTATION phase: Cover all subtopics with age-appropriate activities
9. For the EVALUATION phase: Use practical assessment methods listed above
10. For the ASSIGNMENT: Create hands-on tasks based on real-life applications
`;

  return context;
}

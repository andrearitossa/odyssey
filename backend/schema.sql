-- User authentication and session management (POST-MIGRATION SCHEMA)

-- Anonymous sessions table (renamed from original users table)
-- CREATE TABLE IF NOT EXISTS sessions_anonymous (
--   id INTEGER PRIMARY KEY AUTOINCREMENT,
--   token TEXT UNIQUE NOT NULL,
--   created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--   expires_at DATETIME NOT NULL,
--   last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
-- );

-- Google-authenticated users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_id TEXT UNIQUE NOT NULL,          -- Google OAuth user ID
  email TEXT UNIQUE NOT NULL,              -- User email from Google
  name TEXT NOT NULL,                      -- User display name from Google
  picture_url TEXT,                        -- User profile picture URL
  language TEXT DEFAULT 'English',         -- User preferred language
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Google OAuth sessions table for token management
CREATE TABLE IF NOT EXISTS google_oauth_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  access_token TEXT UNIQUE NOT NULL,
  refresh_token TEXT,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  migration_name TEXT UNIQUE NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- World definitions
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  creator_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Active user sessions
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  world_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (world_id) REFERENCES worlds(id)
);

-- Message history for conversations
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  type TEXT CHECK(type IN ('user', 'narrator')) NOT NULL,
  content TEXT NOT NULL,
  chapter_number INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Story models for each session (MPC storytelling system)
CREATE TABLE IF NOT EXISTS story_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  core_theme_moral_message TEXT NOT NULL,      -- Core theme and moral message
  genre_style_voice TEXT NOT NULL,             -- Genre, style, narrative voice
  setting TEXT NOT NULL,                       -- Setting constraints and world rules
  protagonist TEXT NOT NULL,                   -- Protagonist - user is the main character
  conflict_sources TEXT NOT NULL,              -- Primary conflict sources
  intended_impact TEXT NOT NULL,               -- Intended emotional and intellectual impact
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Chapters for the story (managed by Chapter Manager)
CREATE TABLE IF NOT EXISTS chapters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT CHECK(status IN ('history', 'current', 'future')) NOT NULL,
  decomposition TEXT,                          -- Single line decomposition from Optimizer
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  UNIQUE(session_id, chapter_number)
);

-- Essential indexes for performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_world_id ON sessions(world_id);
CREATE INDEX IF NOT EXISTS idx_worlds_creator_id ON worlds(creator_id);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_chapter_number ON messages(session_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_story_models_session_id ON story_models(session_id);
CREATE INDEX IF NOT EXISTS idx_chapters_session_id ON chapters(session_id);
CREATE INDEX IF NOT EXISTS idx_chapters_session_status ON chapters(session_id, status);

-- Google authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_google_oauth_sessions_user_id ON google_oauth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_google_oauth_sessions_access_token ON google_oauth_sessions(access_token);
CREATE INDEX IF NOT EXISTS idx_google_oauth_sessions_expires_at ON google_oauth_sessions(expires_at);

-- Sample world data (Titanic adventure)
INSERT OR IGNORE INTO worlds (id, title, description) VALUES 
('titanic-adventure',
'The Titanic',
'Titanic, directed by James Cameron, is not just a movie--it''s an emotional journey that leaves a lasting impact. With its breathtaking cinematography, unforgettable performances, and deeply moving storyline, it remains one of the greatest films of all time.
The movie tells the story of two lovers from different social classes who find themselves aboard the ill-fated RMS Titanic. Their love story, set against the backdrop of one of history''s most tragic maritime disasters, creates a powerful blend of romance, drama, and historical recreation that has captivated audiences for over 25 years.
What makes Titanic extraordinary is its meticulous attention to detail and Cameron''s commitment to historical accuracy. The film recreates the grandeur and prestige of the legendary ship with stunning visual effects that still hold up today. Every element, from the ship''s magnificent interiors to the smallest details of period costume design, transports viewers back to 1912. The cinematography captures both the opulence of first-class luxury and the stark realities faced by third-class passengers, highlighting the social inequalities of the era.
Leonardo DiCaprio and Kate Winslet deliver career-defining performances, their natural chemistry bringing depth and authenticity to Jack and Rose''s whirlwind romance. DiCaprio''s Jack is charming, adventurous, and free-spirited, while Winslet''s Rose is trapped by societal expectations until she finds liberation through love. Their relationship serves as both a beautiful love story and a commentary on class divisions and the courage it takes to break free from social constraints.
The story''s emotional impact is amplified by its masterful pacing across three hours that never feel long. The first act introduces us to the characters and the ship''s magnificence, the second act develops the central romance, and the final act delivers one of cinema''s most harrowing disaster sequences. The sinking scenes are particularly powerful, combining practical effects with groundbreaking CGI to create an immersive experience that makes viewers feel they''re actually aboard the doomed vessel.
Celine Dion''s "My Heart Will Go On" became an iconic soundtrack that perfectly captures the film''s emotional essence, while James Horner''s score enhances every moment from tender romance to heart-pounding action. The music has become inseparable from the film''s legacy, evoking the same emotional response decades after its release.
Beyond its technical achievements, Titanic resonates because it explores universal themes of love, sacrifice, class struggle, and human dignity in the face of tragedy. The film doesn''t shy away from showing how the disaster affected people differently based on their social status, making it both a personal love story and a broader commentary on society.
It''s a film that touch hearts across cultures and generations.
Titanic stands as a testament to the power of filmmaking to combine spectacular entertainment with genuine emotion, creating an experience that is both a visual feast and a profound emotional journey that stays with viewers long after the credits roll.');

INSERT OR IGNORE INTO worlds (id, title, description) VALUES
('the-kreutzer-sonata',
  'The Kreutzer Sonata',
  'The Kreutzer Sonata is a chilling and provocative novella by Leo Tolstoy, a profound and disturbing exploration of love, marriage, jealousy, and the destructive power of societal conventions, set in late 19th-century Russia. The narrative unfolds as a confession from Pozdnyshev, an aristocratic gentleman, during a train journey. He recounts the tragic story of his marriage and the eventual murder of his wife, spurred by an agonizing jealousy ignited by her seemingly innocent musical collaboration with a violinist.

The plot begins with a discussion among fellow train passengers about the nature of love, marriage, and infidelity, which prompts Pozdnyshev to reveal his own deeply troubled experiences. He details the early stages of his marriage, characterized by passionate physical attraction that he retrospectively views as a destructive force, devoid of true spiritual connection. As years pass and children are born, he describes a growing chasm between himself and his wife, fueled by mutual resentment, boredom, and a suffocating sense of domesticity. The arrival of a gifted violinist, Trukhachevsky, and the subsequent performances of Beethoven''s "Kreutzer Sonata" by him and Pozdnyshev''s wife, act as a catalyst. Pozdnyshev interprets their shared musical passion as a covert expression of their burgeoning adultery, despite any explicit evidence. His jealousy escalates into a furious obsession, culminating in a violent confrontation and the murder of his wife. The novella concludes with Pozdnyshev reflecting on his actions and delivering a scathing indictment of conventional marriage, sexual desire, and the hypocrisy he perceives in society.

**Themes:** The novella grapples with intense and often controversial themes:
* **The Destructive Nature of Jealousy:** The core theme is the all-consuming and ultimately murderous power of jealousy, meticulously dissected through Pozdnyshev''s tormented psyche.
* **Critique of Marriage and Sexual Love:** Tolstoy, through Pozdnyshev, launches a scathing attack on what he perceives as the base, animalistic nature of sexual desire and its corrupting influence on marriage. He argues that marriage based solely on physical attraction is inherently flawed and prone to suffering.
* **Hypocrisy and Societal Morality:** The novella exposes the moral hypocrisy of society, particularly concerning gender roles, sexual double standards, and the superficiality of social interactions.
* **The Spiritual vs. the Physical:** A central tension exists between what Pozdnyshev sees as pure, spiritual love and the degrading nature of physical desire.
* **The Power of Art (and its Perceived Dangers):** The "Kreutzer Sonata" itself serves as a powerful symbol, capable of stirring deep emotions and, in Pozdnyshev''s distorted view, inciting illicit passion.

**Settings:** The primary setting is the enclosed, intimate space of a train carriage, which facilitates Pozdnyshev''s extended, intense confession. Flashbacks transport the reader to the domestic sphere of his marriage, highlighting the claustrophobia and emotional decay within their home.

**Style:** Tolstoy''s distinctive style is evident throughout:
* **Introspective and Confessional:** The entire narrative is framed as a long, impassioned monologue, offering deep insight into Pozdnyshev''s disturbed mental state.
* **Psychological Realism:** Tolstoy delves deeply into the complex and often irrational workings of the human mind, particularly the descent into madness driven by obsession.
* **Didactic Tone:** The novella carries a strong moral and philosophical message, with Pozdnyshev acting as a mouthpiece for Tolstoy''s radical views on marriage and sexuality.
* **Intense Emotionality:** Despite the philosophical underpinnings, the narrative is charged with raw emotion, from passionate love to seething hatred and despair.

**Voice of the Narrator:** Pozdnyshev is the sole narrator, delivering his story in a fervent, often rambling, and self-justifying tone. His voice is highly subjective, unreliable, and deeply disturbed, yet compelling in its intensity. He oscillates between fervent moralizing and agonizing self-pity, offering a chilling portrayal of a man consumed by his own obsessions.

**Conflict Sources:**
* **Internal Conflict:** Pozdnyshev''s primary struggle is internal, battling his own escalating jealousy, misinterpretations, and a profound sense of moral disgust.
* **Man vs. Society/Conventions:** He is in conflict with the societal norms and expectations surrounding marriage and sexuality, which he vehemently critiques.
* **Man vs. Woman:** The strained and ultimately destructive relationship with his wife is a central conflict, fueled by miscommunication, resentment, and a fundamental misunderstanding of each other.

**Intended Emotional Impact:** The novella aims to provoke discomfort, unease, and critical reflection on deeply ingrained societal norms. It is designed to be disturbing and morally challenging, forcing the reader to confront uncomfortable truths about human nature, the complexities of relationships, and the potential for psychological torment to erupt into violence. It leaves a lingering sense of tragedy, moral ambiguity, and profound psychological distress.
');

INSERT OR IGNORE INTO worlds (id, title, description) VALUES 
('a-farewell-to-arms',
  'A Farewell to Arms',
  'A Farewell to Arms is a deeply moving and semi-autobiographical novel by Ernest Hemingway, set amidst the brutal and chaotic landscape of World War I, primarily on the Italian front. The narrative follows Frederic Henry, a cynical yet reflective American ambulance driver in the Italian Army, as he navigates the physical and psychological toll of war.
The plot unfolds in several distinct phases. Initially, Frederic''s life is characterized by the grim realities of the front, punctuated by visits to brothels and a detached observation of the conflict. A severe leg injury during a bombardment leads to his hospitalization in Milan, where he encounters Catherine Barkley, a British nurse mourning the loss of her fiancé. Their intense and passionate love affair quickly blossoms, offering a fragile sense of solace and escape from the surrounding violence. As Frederic recovers, their relationship deepens, marked by both tender moments and underlying anxieties about their uncertain future.
Upon his return to the front, Frederic experiences the horrific realities of the Italian retreat from Caporetto, a chaotic and demoralizing defeat that exposes the true barbarity of war. Witnessing the summary execution of officers by the Carabinieri, and narrowly escaping his own potential execution, Frederic makes the pivotal decision to desert the army, symbolically "making a separate peace" with the war. He reunites with Catherine, now pregnant, and they embark on a desperate journey to escape to neutral Switzerland, seeking a peaceful refuge. The latter part of the novel depicts their idyllic but ultimately tragic life in Switzerland, culminating in a devastating personal loss that underscores the inescapable and pervasive nature of suffering, even far removed from the battlefield.

**Themes:** The novel delves into profound themes:
* **Love and Loss:** The central romance between Frederic and Catherine is a powerful exploration of love as a desperate solace in a world consumed by destruction, ultimately highlighting its fragility in the face of insurmountable odds.
* **The Brutality and Futility of War:** Hemingway vividly portrays the senseless violence, chaos, and disillusionment inherent in armed conflict, stripping away any romantic notions of glory or heroism.
* **Disillusionment and Existentialism:** Frederic''s journey reflects a growing cynicism and detachment from traditional ideals and institutions, particularly the patriotism and honor associated with war. He grapples with the arbitrary nature of life and death, seeking meaning in personal connections rather than grand narratives.
* **Duty vs. Personal Freedom:** The conflict between obligation to the state and the desire for individual liberty and peace is central to Frederic''s decision to desert.
* **The Search for Meaning:** Amidst the pervasive despair, the characters desperately seek to find purpose and happiness, however fleeting, in their personal relationships.

**Settings:** The narrative moves from the muddy, perilous Italian front lines and field hospitals to the bustling, more comfortable city of Milan, and finally to the serene, snow-capped landscapes of Switzerland, each setting reflecting different stages of the characters'' emotional and physical journeys.

**Style:** Hemingway''s signature prose style is a hallmark of the novel:
* **Minimalism and Understatement:** He employs sparse, direct language, avoiding overt emotional expression and allowing the reader to infer deeper meanings.
* **Concise Dialogue:** Dialogue is sharp, realistic, and often carries significant unspoken tension.
* **Iceberg Theory:** Much of the meaning lies beneath the surface, with emotions and psychological states conveyed through actions and implied details rather than explicit descriptions.
* **Repetition:** Strategic repetition of words and phrases creates a rhythmic quality and emphasizes certain ideas or feelings.

**Voice of the Narrator:** The story is told through the first-person perspective of Frederic Henry. His voice is detached, observant, and initially somewhat cynical, evolving to become more reflective and emotionally vulnerable as he experiences profound love and loss. He presents events with a journalistic precision, yet his internal monologues reveal a deep, often unarticulated, emotional landscape.

**Conflict Sources:**
* **Man vs. War/Society:** The primary conflict is Frederic''s struggle against the overwhelming and dehumanizing forces of war and the societal expectations tied to it.
* **Man vs. Nature/Fate:** The characters are also at the mercy of uncontrollable forces, both the unpredictable nature of conflict and the harsh realities of life and death.
* **Internal Conflict:** Frederic grapples with his own disillusionment, his evolving sense of duty, and his capacity for love and despair.

**Intended Emotional Impact:** Hemingway aims to evoke a profound sense of pathos, melancholy, and the tragic beauty of human resilience in the face of immense suffering. The reader is meant to feel the raw emotional intensity of love and loss, the crushing weight of war, and the quiet despair of a world where even the purest connections can be shattered. The novel leaves a lasting impression of the fragility of happiness and the enduring, often solitary, nature of grief.'
);

INSERT OR IGNORE INTO worlds (id, title, description) VALUES (
  'family-guy',
  'Family Guy',
  'Family Guy is a long-running, Emmy Award-winning American animated sitcom created by Seth MacFarlane, renowned for its irreverent humor, cutaway gags, and sharp social commentary. Set in the fictional city of Quahog, Rhode Island, the series centers on the dysfunctional adventures of the Griffin family: Peter, the well-meaning but dim-witted patriarch; Lois, his more intelligent and often exasperated wife; their three children—Meg, the perpetually bullied and overlooked eldest; Chris, the unintelligent and overweight middle child; and Stewie, the evil genius infant with a sophisticated vocabulary and a penchant for world domination; along with Brian, the family''s cultured, anthropomorphic, martini-swilling dog.

The plot of individual episodes typically revolves around the Griffins'' often absurd daily lives, which quickly escalate into outlandish and surreal scenarios. These scenarios frequently break from traditional narrative structure, incorporating non-sequitur cutaway gags, musical numbers, and meta-references that comment on pop culture, politics, and the show itself. While a loose plot drives each episode, the emphasis is heavily placed on rapid-fire jokes, character interactions, and satirical commentary rather than intricate storytelling arcs across seasons, though character dynamics and certain running gags do evolve over time.

**Themes:** The series tackles a wide array of themes, often through satire and parody:
* **The American Family:** A deconstruction and often brutal satire of the traditional American sitcom family, exposing its absurdities and dysfunctions.
* **Pop Culture and Media Satire:** Constant referencing and lampooning of movies, television shows, music, and celebrity culture.
* **Social and Political Commentary:** Often takes aim at controversial topics, political figures, societal norms, and contemporary issues, frequently using shock humor and exaggeration to make its points.
* **Dysfunction and Absurdity:** Explores the chaotic and often illogical nature of human relationships and everyday life, pushed to extreme comedic limits.
* **Identity and Belonging:** Particularly through characters like Meg and Stewie, the show touches on themes of searching for acceptance and purpose, albeit with a dark comedic twist.

**Settings:** Primarily set in the suburban landscape of Quahog, Rhode Island, with frequent ventures into various fantastical or real-world locations as dictated by the show''s often outlandish plotlines and cutaways. Key locations include the Griffin home, the Drunken Clam pub, and James Woods High School.

**Style:** Family Guy''s distinctive comedic style is its most defining characteristic:
* **Cutaway Gags:** Its most famous stylistic device, where the narrative suddenly diverges into a brief, often surreal and unrelated scene triggered by a character''s thought or comment.
* **Meta-humor:** Frequent breaking of the fourth wall and self-referential jokes about the show''s own production, status, and reception.
* **Black Comedy and Shock Humor:** Utilizes offensive, controversial, and often taboo subjects for comedic effect, pushing boundaries with its jokes.
* **Musical Numbers:** Features frequent and elaborate musical sequences, often parodies of Broadway or popular songs.
* **Non-sequiturs:** Jokes and situations that lack logical connection to the preceding narrative, contributing to the show''s anarchic tone.

**Voice of the Characters/Narrative:** The series does not have a single narrator but instead relies on the distinct and often exaggerated personalities of its main characters. Peter Griffin often serves as the unwitting catalyst for many plots, while Stewie and Brian frequently provide more sophisticated, cynical, or intellectual commentary, often acting as a comedic duo. The humor largely comes from the clash of these personalities and their often inappropriate reactions to situations.

**Conflict Sources:**
* **Interpersonal Dysfunction:** The internal conflicts within the Griffin family, driven by their individual eccentricities and clashes of personality.
* **Man vs. Absurdity:** The characters frequently find themselves in bizarre, unrealistic situations that defy logic.
* **Social/Political Commentary:** The show often sets up conflicts between its characters and various societal norms, political ideologies, or celebrity behaviors, which it then satirizes.
* **External Forces:** While less common for long-term arcs, external threats or challenges sometimes drive individual episodes, often quickly resolving in ridiculous ways.

**Intended Emotional Impact:** Family Guy aims primarily to entertain through laughter, shock, and satire. It seeks to provoke thought on contemporary issues by presenting them through an exaggerated, often offensive, and highly comedic lens. While not aiming for deep emotional resonance in the traditional dramatic sense, it can evoke feelings of surprise, amusement, and sometimes discomfort, prompting viewers to question societal norms and the absurdities of modern life.'
)
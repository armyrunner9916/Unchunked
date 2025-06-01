import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Switch,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const { width, height } = Dimensions.get('window');

const App = () => {
  // Game states
  const [gameState, setGameState] = useState('splash'); // splash, instructions, setup, game, gameover
  const [playerName, setPlayerName] = useState('');
  const [wordCount, setWordCount] = useState(5);
  const [dictionary, setDictionary] = useState([]);
  const [currentWords, setCurrentWords] = useState([]);
  const [chunks, setChunks] = useState([]);
  const [selectedChunks, setSelectedChunks] = useState([]);
  const [remainingGuesses, setRemainingGuesses] = useState(0);
  const [remainingHints, setRemainingHints] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showHighScores, setShowHighScores] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  
  // Sound refs
  const gameOverSound = useRef(null);
  const victorySound = useRef(null);
  
  // Timer ref
  const timerRef = useRef(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
    loadSounds();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unloadSounds();
    };
  }, []);

  // Load sounds
  const loadSounds = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
      });
      
      const { sound: gameOver } = await Audio.Sound.createAsync(
        { uri: 'https://raw.githubusercontent.com/armyrunner9916/nine_letter_words.txt/main/Game_over.mp3' }
      );
      gameOverSound.current = gameOver;
      
      const { sound: victory } = await Audio.Sound.createAsync(
        { uri: 'https://raw.githubusercontent.com/armyrunner9916/nine_letter_words.txt/main/Cheer.mp3' }
      );
      victorySound.current = victory;
    } catch (error) {
      console.log('Error loading sounds:', error);
    }
  };

  const unloadSounds = async () => {
    try {
      if (gameOverSound.current) {
        await gameOverSound.current.unloadAsync();
      }
      if (victorySound.current) {
        await victorySound.current.unloadAsync();
      }
    } catch (error) {
      console.log('Error unloading sounds:', error);
    }
  };

  const playSound = async (soundType) => {
    if (!isSoundOn) return;
    
    try {
      if (soundType === 'gameover' && gameOverSound.current) {
        await gameOverSound.current.replayAsync();
      } else if (soundType === 'victory' && victorySound.current) {
        await victorySound.current.replayAsync();
      }
    } catch (error) {
      console.log('Error playing sound:', error);
    }
  };

  const loadInitialData = async () => {
    try {
      // Load dictionary
      const response = await fetch('https://raw.githubusercontent.com/armyrunner9916/nine_letter_words.txt/refs/heads/main/nine_letter_words.txt');
      const text = await response.text();
      const words = text.split('\n').filter(word => word.length === 9).map(word => word.trim().toUpperCase());
      setDictionary(words);
      
      // Load saved data
      const savedName = await AsyncStorage.getItem('playerName');
      if (savedName) setPlayerName(savedName);
      
      const savedScores = await AsyncStorage.getItem('highScores');
      if (savedScores) setHighScores(JSON.parse(savedScores));
      
      const savedDarkMode = await AsyncStorage.getItem('darkMode');
      if (savedDarkMode) setIsDarkMode(JSON.parse(savedDarkMode));
      
      const savedSound = await AsyncStorage.getItem('soundOn');
      if (savedSound !== null) setIsSoundOn(JSON.parse(savedSound));
      
      // Start splash animation
      setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => {
          setGameState('instructions');
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        });
      }, 2000);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const startGame = () => {
    if (!playerName.trim()) {
      Alert.alert('Error', 'Please enter your name!');
      return;
    }
    
    const selectedWords = dictionary.sort(() => Math.random() - 0.5).slice(0, wordCount);
    setCurrentWords(selectedWords);
    
    // Create chunks
    const allChunks = [];
    selectedWords.forEach(word => {
      for (let i = 0; i < 9; i += 3) {
        allChunks.push({
          text: word.substring(i, i + 3),
          wordIndex: selectedWords.indexOf(word),
          chunkIndex: i / 3,
          id: `${word}-${i}`,
          isSelected: false,
          isCompleted: false,
        });
      }
    });
    
    // Shuffle chunks
    const shuffled = allChunks.sort(() => Math.random() - 0.5);
    setChunks(shuffled);
    
    // Set game parameters
    setRemainingGuesses(wordCount);
    setRemainingHints(wordCount >= 4 ? 4 : 0);
    setTimeRemaining(20 + (wordCount - 2) * 10);
    setSelectedChunks([]);
    setScore(0);
    
    setGameState('game');
    startTimer();
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          endGame(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const selectChunk = (chunk) => {
    if (chunk.isCompleted) return;
    
    if (chunk.isSelected) {
      // Deselect
      setSelectedChunks(prev => prev.filter(c => c.id !== chunk.id));
      setChunks(prev => prev.map(c => 
        c.id === chunk.id ? { ...c, isSelected: false } : c
      ));
    } else if (selectedChunks.length < 3) {
      // Select
      setSelectedChunks(prev => [...prev, chunk]);
      setChunks(prev => prev.map(c => 
        c.id === chunk.id ? { ...c, isSelected: true } : c
      ));
    }
  };

  const submitGuess = () => {
    if (selectedChunks.length !== 3) return;
    
    // Check if chunks form a valid word
    const sortedChunks = [...selectedChunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
    const isValid = sortedChunks.every((chunk, index) => 
      chunk.wordIndex === sortedChunks[0].wordIndex && 
      chunk.chunkIndex === index
    );
    
    if (isValid) {
      // Correct guess
      setChunks(prev => prev.map(c => 
        selectedChunks.some(sc => sc.id === c.id) 
          ? { ...c, isCompleted: true, isSelected: false } 
          : c
      ));
      setScore(prev => prev + 1);
      
      // Check if game is won
      if (score + 1 === wordCount) {
        endGame(true);
      }
    } else {
      // Wrong guess
      setRemainingGuesses(prev => {
        const newGuesses = prev - 1;
        if (newGuesses === 0) {
          endGame(false);
        }
        return newGuesses;
      });
    }
    
    // Clear selection
    setSelectedChunks([]);
    setChunks(prev => prev.map(c => ({ ...c, isSelected: false })));
  };

  const useHint = () => {
    if (remainingHints === 0 || selectedChunks.length >= 2) return;
    
    // Find an incomplete word
    const incompleteWordIndex = currentWords.findIndex((word, index) => 
      !chunks.some(c => c.wordIndex === index && c.isCompleted)
    );
    
    if (incompleteWordIndex === -1) return;
    
    // Find the next chunk to hint
    const hintChunkIndex = selectedChunks.filter(c => c.wordIndex === incompleteWordIndex).length;
    const hintChunk = chunks.find(c => 
      c.wordIndex === incompleteWordIndex && 
      c.chunkIndex === hintChunkIndex && 
      !c.isCompleted
    );
    
    if (hintChunk) {
      selectChunk(hintChunk);
      setRemainingHints(prev => prev - 1);
    }
  };

  const endGame = async (isVictory) => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    playSound(isVictory ? 'victory' : 'gameover');
    
    if (isVictory) {
      // Save high score
      const newScore = {
        name: playerName,
        level: wordCount,
        date: new Date().toISOString(),
      };
      
      const newHighScores = [...highScores, newScore]
        .sort((a, b) => b.level - a.level || new Date(b.date) - new Date(a.date))
        .slice(0, 10);
      
      setHighScores(newHighScores);
      await AsyncStorage.setItem('highScores', JSON.stringify(newHighScores));
    }
    
    Alert.alert(
      isVictory ? 'Victory!' : 'Game Over',
      isVictory ? `Congratulations! You completed all ${wordCount} words!` : 'Better luck next time!',
      [
        { text: 'New Game', onPress: () => setGameState('setup') },
        { text: 'Main Menu', onPress: () => setGameState('instructions') },
      ]
    );
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const saveSettings = async () => {
    await AsyncStorage.setItem('darkMode', JSON.stringify(isDarkMode));
    await AsyncStorage.setItem('soundOn', JSON.stringify(isSoundOn));
  };

  const theme = {
    bg: isDarkMode ? '#000' : '#f5f5f5',
    text: isDarkMode ? '#ffffff' : '#000000',
    card: isDarkMode ? 'rgba(30,30,30,0.8)' : '#ffffff',
    button: '#6FBA44',
    hint: '#2196F3',
    danger: '#f44336',
    selected: '#FFA726',
    completed: '#66BB6A',
  };

  const renderSplash = () => (
    <Animated.View style={[styles.container, { backgroundColor: theme.bg, opacity: fadeAnim }]}>
      <Text style={[styles.title, { color: theme.text, fontSize: 48 }]}>UNCHUNKED</Text>
      <Text style={[styles.subtitle, { color: theme.text }]}>Piece Together the Words</Text>
    </Animated.View>
  );

  const renderInstructions = () => (
    <Animated.View style={[styles.container, { backgroundColor: theme.bg, opacity: fadeAnim }]}>
      <View style={[styles.instructionsCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.title, { color: theme.text, fontSize: 36, marginBottom: 30 }]}>Welcome to Unchunked!</Text>
        <Text style={[styles.instructions, { color: theme.text }]}>
          We've taken 9-letter words and broken them into 3-letter chunks—now it's your job to put them back together! 
          Tap the chunks in the right order to rebuild the words. Need a boost? You've got 4 hints to help you out.
        </Text>
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.button, paddingHorizontal: 60 }]}
          onPress={() => setGameState('setup')}
        >
          <Text style={[styles.buttonText, { textTransform: 'uppercase', letterSpacing: 1 }]}>Let's Play!</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  const renderSetup = () => (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.setupTitle, { color: theme.text }]}>
        Enter your name and choose how many words to descramble!
      </Text>
      
      <TextInput
        style={[styles.setupInput, { color: theme.text, backgroundColor: isDarkMode ? 'rgba(60,60,60,0.8)' : '#f0f0f0' }]}
        placeholder="Enter your name"
        placeholderTextColor={isDarkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
        value={playerName}
        onChangeText={async (text) => {
          setPlayerName(text);
          await AsyncStorage.setItem('playerName', text);
        }}
      />
      
      <View style={styles.wordCountControl}>
        <TouchableOpacity 
          style={[styles.countButton, { backgroundColor: theme.button }]}
          onPress={() => setWordCount(Math.max(2, wordCount - 1))}
        >
          <Text style={styles.countButtonText}>-</Text>
        </TouchableOpacity>
        
        <View style={[styles.wordCountDisplay, { backgroundColor: isDarkMode ? 'rgba(60,60,60,0.8)' : '#f0f0f0' }]}>
          <Text style={[styles.wordCountText, { color: theme.text }]}>{wordCount}</Text>
        </View>
        
        <TouchableOpacity 
          style={[styles.countButton, { backgroundColor: theme.button }]}
          onPress={() => setWordCount(Math.min(10, wordCount + 1))}
        >
          <Text style={styles.countButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={[styles.startButton, { backgroundColor: '#555' }]}
        onPress={startGame}
        disabled={!playerName.trim()}
      >
        <Text style={[styles.buttonText, { fontSize: 18 }]}>Start Game</Text>
      </TouchableOpacity>
      
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={[styles.footerText, { color: theme.text }]}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowHighScores(true)}>
          <Text style={[styles.footerText, { color: theme.text }]}>High Scores</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGame = () => {
    // Dynamic chunk sizing based on word count
    const chunkSize = wordCount <= 4 ? 90 : wordCount <= 7 ? 75 : 65;
    const chunkFontSize = wordCount <= 4 ? 18 : wordCount <= 7 ? 16 : 14;
    
    return (
      <View style={[styles.gameContainer, { backgroundColor: theme.bg }]}>
        <View style={styles.gameHeader}>
          <Text style={[styles.headerText, { color: theme.text }]}>UNCHUNKED</Text>
          <View style={styles.headerControls}>
            <Switch
              value={isDarkMode}
              onValueChange={(value) => {
                setIsDarkMode(value);
                saveSettings();
              }}
            />
            <Text style={[styles.smallText, { color: theme.text, marginLeft: 10 }]}>
              Sound {isSoundOn ? 'ON' : 'OFF'}
            </Text>
            <Switch
              value={isSoundOn}
              onValueChange={(value) => {
                setIsSoundOn(value);
                saveSettings();
              }}
              style={{ marginLeft: 10 }}
            />
          </View>
        </View>
        
        <View style={styles.gameInfo}>
          <Text style={[styles.infoText, { color: theme.text }]}>Player: {playerName}</Text>
          <Text style={[styles.infoText, { color: theme.text }]}>Remaining Guesses: {remainingGuesses}</Text>
          <Text style={[styles.infoText, { color: theme.text }]}>Remaining Hints: {remainingHints}</Text>
          <Text style={[styles.infoText, { color: theme.text }]}>Time Remaining: {formatTime(timeRemaining)}</Text>
        </View>
        
        <ScrollView 
          style={styles.gameScrollView}
          contentContainerStyle={styles.gameScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.chunkGrid}>
            {chunks.map((chunk, index) => (
              <TouchableOpacity
                key={chunk.id}
                style={[
                  styles.chunk,
                  {
                    width: chunkSize,
                    height: chunkSize * 0.7,
                    backgroundColor: chunk.isCompleted ? theme.completed : 
                                   chunk.isSelected ? theme.selected : 
                                   theme.card,
                    opacity: chunk.isCompleted ? 0.5 : 1,
                  }
                ]}
                onPress={() => selectChunk(chunk)}
                disabled={chunk.isCompleted}
              >
                <Text style={[styles.chunkText, { color: theme.text, fontSize: chunkFontSize }]}>{chunk.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        
        <View style={styles.gameButtons}>
          <TouchableOpacity
            style={[
              styles.gameButton,
              {
                backgroundColor: selectedChunks.length === 3 ? theme.button : theme.hint,
                opacity: selectedChunks.length === 3 || (remainingHints > 0 && selectedChunks.length < 2) ? 1 : 0.5,
              }
            ]}
            onPress={selectedChunks.length === 3 ? submitGuess : useHint}
            disabled={selectedChunks.length === 3 ? false : (remainingHints === 0 || selectedChunks.length >= 2)}
          >
            <Text style={styles.buttonText}>
              {selectedChunks.length === 3 ? 'Submit Guess' : 'Hint'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.gameButton, { backgroundColor: theme.danger }]}
            onPress={() => endGame(false)}
          >
            <Text style={styles.buttonText}>Give Up</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.gameFooter}>
          <TouchableOpacity onPress={() => setShowSettings(true)}>
            <Text style={[styles.footerText, { color: theme.text }]}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowHighScores(true)}>
            <Text style={[styles.footerText, { color: theme.text }]}>High Scores</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderSettings = () => (
    <Modal visible={showSettings} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>Settings</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Dark Mode</Text>
            <Switch
              value={isDarkMode}
              onValueChange={(value) => {
                setIsDarkMode(value);
                saveSettings();
              }}
            />
          </View>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.text }]}>Sound Effects</Text>
            <Switch
              value={isSoundOn}
              onValueChange={(value) => {
                setIsSoundOn(value);
                saveSettings();
              }}
            />
          </View>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.button }]}
            onPress={() => setShowSettings(false)}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderHighScores = () => (
    <Modal visible={showHighScores} transparent animationType="slide">
      <View style={styles.modalContainer}>
        <View style={[styles.modal, { backgroundColor: theme.card }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]}>High Scores</Text>
          
          <ScrollView style={styles.scoreList}>
            {highScores.length === 0 ? (
              <Text style={[styles.noScores, { color: theme.text }]}>No scores yet!</Text>
            ) : (
              highScores.map((score, index) => (
                <View key={index} style={styles.scoreRow}>
                  <Text style={[styles.scoreText, { color: theme.text }]}>
                    {index + 1}. {score.name}
                  </Text>
                  <Text style={[styles.scoreText, { color: theme.text }]}>
                    Level {score.level}
                  </Text>
                  <Text style={[styles.scoreDate, { color: theme.text }]}>
                    {new Date(score.date).toLocaleDateString()}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.button }]}
            onPress={() => setShowHighScores(false)}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {gameState === 'splash' && renderSplash()}
      {gameState === 'instructions' && renderInstructions()}
      {gameState === 'setup' && renderSetup()}
      {gameState === 'game' && renderGame()}
      {renderSettings()}
      {renderHighScores()}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameContainer: {
    flex: 1,
  },
  gameHeader: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.8,
  },
  card: {
    padding: 30,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
  },
  instructionsCard: {
    padding: 40,
    paddingHorizontal: 50,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: 800,
    width: '90%',
  },
  instructions: {
    fontSize: 20,
    lineHeight: 32,
    marginBottom: 40,
    textAlign: 'center',
    fontWeight: '300',
  },
  setupTitle: {
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 50,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 36,
  },
  setupInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    width: '90%',
    maxWidth: 400,
  },
  wordCountControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    gap: 20,
  },
  countButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  wordCountDisplay: {
    width: 80,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordCountText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  startButton: {
    paddingVertical: 16,
    paddingHorizontal: 50,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 30,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 30,
    alignItems: 'center',
    marginVertical: 5,
  },
  gameButton: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 30,
    flex: 1,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  gameInfo: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoText: {
    fontSize: 16,
    marginVertical: 2,
  },
  gameScrollView: {
    flex: 1,
  },
  gameScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chunkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chunk: {
    margin: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  chunkText: {
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  gameButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 20,
  },
  gameFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 30,
    gap: 30,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    gap: 30,
  },
  footerText: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    padding: 30,
    borderRadius: 15,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  settingLabel: {
    fontSize: 16,
  },
  scoreList: {
    maxHeight: 300,
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  scoreText: {
    fontSize: 16,
  },
  scoreDate: {
    fontSize: 14,
    opacity: 0.7,
  },
  noScores: {
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.7,
    marginVertical: 20,
  },
  smallText: {
    fontSize: 14,
  },
});

export default App;
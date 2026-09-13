import react from 'react';

import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
} from 'react-native';

export default function HomeScreen({ navigation }) {

  return (
    <View style={styles.container}>
      <View style={styles.content}>

        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/image/truck.png')}
            style={styles.imageTruck}
            resizeMode="cover"
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>
            Simplify Your Life:{'\n'}
            Smarthome Solutions
          </Text>

          <Text style={styles.subtitle}>
            Experience effortless living with our Smarthome solutions.
            Control your home with ease and convenience.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.buttonText}>
            Começar
          </Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 0,
    margin: 0
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignItems: 'center',
    flexDirection: 'column'
  },

  imageContainer: {
    width: 375,
    height: 440,
    backgroundColor: '#1E1E1E',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    overflow: 'hidden',
  },

  imageTruck: {
    width: '100%',
    height: '100%',
  },

  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 30,
    marginVertical: 20,
  },

  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 32,
  },

  subtitle: {
    fontSize: 14,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 20,
  },

  button: {
    width: 211,
    height: 60,
    backgroundColor: '#3B56FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});


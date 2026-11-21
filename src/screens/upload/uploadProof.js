import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { enviarOuGuardar } from '../../services/offline.js';
import BottomNavigation from '../../components/bottomNavigation/bottomNavigation';

export default function UploadProofScreen({ navigation, route }) {
  const [imageUri, setImageUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const { usuario } = route?.params || {};

  // Função para tirar foto usando a Câmera
  const takePhotoWithCamera = async () => {
    const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
    
    if (cameraPermission.granted === false) {
      Alert.alert("Permissão negada", "Precisamos de permissão para acessar a câmera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Função para escolher da Galeria
  const pickImageFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permissão negada", "Precisamos de permissão para acessar suas fotos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Menu de escolha (Câmera ou Galeria)
  const showImagePickerOptions = () => {
    Alert.alert(
      "Selecionar Comprovante",
      "Escolha como deseja enviar o comprovante:",
      [
        { text: "Tirar Foto (Câmera)", onPress: takePhotoWithCamera },
        { text: "Escolher da Galeria", onPress: pickImageFromGallery },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const uploadImage = async () => {
    if (!imageUri) {
      Alert.alert("Atenção", "Selecione ou tire uma foto do comprovante primeiro.");
      return;
    }

    setLoading(true);

    try {
      // Erro I1/P12: a rota /comprovantes/upload agora existe e guarda o arquivo no Storage.
      // Sem internet (motorista), a foto fica guardada no celular e vai quando a conexão voltar.
      const r = await enviarOuGuardar('comprovante', { arquivo: { uri: imageUri } }, 'Comprovante avulso');
      Alert.alert(
        r.offline ? "Salvo no celular" : "Sucesso",
        r.offline ? "Sem internet agora. O comprovante será enviado quando a conexão voltar." : "Comprovante enviado com sucesso!"
      );
      setImageUri(null);
      navigation.goBack();
    } catch (error) {
      console.error("Erro no upload:", error);
      Alert.alert("Erro", error.message || "Não foi possível enviar a imagem ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>

        <View style={styles.headerContainer}>
          <Text style={styles.title}>
            Enviar <Text style={styles.titleX}>Comprovante</Text>
          </Text>
          <Text style={styles.subtitle}>
            Tire uma foto ou escolha da galeria{'\n'}para salvar no sistema
          </Text>
        </View>

        {/* Agora ao tocar na caixa, abre as opções de Câmera ou Galeria */}
        <TouchableOpacity style={styles.imagePickerBox} onPress={showImagePickerOptions} activeOpacity={0.8}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.previewImage} />
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderIcon}>📷</Text>
              <Text style={styles.placeholderText}>Toque para tirar foto ou escolher</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.uploadButton, loading && styles.buttonDisabled]} 
            activeOpacity={0.8}
            onPress={uploadImage}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.uploadButtonText}>Enviar Comprovante</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>

      <BottomNavigation navigation={navigation} userRole={usuario?.role} usuario={usuario} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    justifyContent: 'flex-start',
  },
  backButton: {
    marginBottom: 10,
    width: 40,
    paddingTop: 20,
  },
  backArrow: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 36,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  titleX: {
    color: '#3B56FF',
  },
  subtitle: {
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
  },
  imagePickerBox: {
    width: '100%',
    height: 280,
    backgroundColor: '#1A1A1A',
    borderWidth: 1.5,
    borderColor: '#3045FF',
    borderStyle: 'dashed',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 10,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  placeholderText: {
    color: '#888888',
    fontSize: 14,
  },
  footer: {
    marginTop: 'auto',
    marginBottom: 40,
    alignItems: 'center',
  },
  uploadButton: {
    width: '100%',
    height: 54,
    backgroundColor: '#3B56FF',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
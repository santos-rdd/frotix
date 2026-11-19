import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Carrega dados do backend sempre que a tela ganha foco (ex.: ao voltar de um cadastro).
 * carregar: função async que devolve os dados.
 * Retorna { dados, carregando, erro, recarregar }.
 */
export default function useDados(carregar, inicial = null) {
  const [dados, setDados] = useState(inicial);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const funcao = useRef(carregar);
  funcao.current = carregar;

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await funcao.current());
      setErro(null);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar os dados.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar])
  );

  return { dados, carregando, erro, recarregar };
}

import { defineConfig } from "vitest/config";

/**
 * Configuracion de Vitest.
 *
 * Existe por una sola razon: el limite de tiempo por prueba.
 *
 * El limite por omision son 5 segundos, y varias pruebas de cierre
 * superan eso haciendo trabajo legitimo: la de los 31 dias de octubre
 * recorre la cartera completa un dia tras otro, reconstruyendo el
 * paquete canonico desde los CSV en cada corte. Treinta y un recorridos
 * de setenta y cinco creditos no caben en cinco segundos.
 *
 * Corriendo ese archivo solo entraban por poco; en la suite completa,
 * con los demas archivos compitiendo en paralelo, se pasaban. Es la
 * peor clase de fragilidad: la prueba no esta mal, el presupuesto de
 * tiempo si, y falla segun lo ocupada que este la maquina.
 *
 * Importa mas de lo que parece, porque el enunciado pide que `npm test`
 * pase EN CAMARA durante el video. Una prueba que falla por estar la
 * maquina ocupada, grabando, es exactamente lo que no puede pasar.
 *
 * Treinta segundos no esconde nada: ninguna prueba llama a la red ni a
 * un modelo de lenguaje —eso se hace con el modelo guionizado— asi que
 * una que tardara tanto estaria colgada de verdad y el limite la
 * seguiria delatando.
 */
export default defineConfig({
    test: {
        testTimeout: 30_000,
        hookTimeout: 30_000
    }
});

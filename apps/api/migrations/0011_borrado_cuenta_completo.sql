-- 0011_borrado_cuenta_completo: el borrado de cuenta borra también el
-- perfil de detective y los resultados oficiales del usuario.
--
-- Hueco: DELETE /api/v1/account anonimizaba el perfil y revocaba
-- sesiones y tokens, pero dejaba huérfanas la fila de
-- `detective_profiles` (el alias es dato personal) y las de
-- `official_results`. La migración 0009 solo concedió SELECT/INSERT/
-- UPDATE sobre detective_profiles y la 0010 solo SELECT/INSERT sobre
-- official_results, así que la app ni siquiera podía borrarlas.
--
-- Decisión de diseño: el borrado se hace en el handler de borrado de
-- cuenta, NO en `delete_run`. El resultado oficial es un registro de
-- carrera del jugador, no de la partida: borrar una partida
-- (`delete_run`) lo conserva por diseño (migración 0010) y un segundo
-- cierre del mismo contenido es práctica. El evento de borrado total
-- es la baja de cuenta (GDPR art. 17): ahí sí deben desaparecer el
-- perfil de detective y los resultados oficiales del usuario, en la
-- misma transacción que el resto del borrado.
--
-- Nota: la migración 0010 decía que el registro oficial «sobrevive»
-- al borrado de cuenta; esta migración deja sin efecto esa decisión.
-- Las migraciones aplicadas no se reescriben, por eso queda aquí.

GRANT DELETE ON "detective_profiles" TO "meridiano_app";
GRANT DELETE ON "official_results" TO "meridiano_app";

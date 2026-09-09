"""
Genera los beats (MIDI completo + stems) de las cinco emociones con género
'trap' y tempo 140, imprimiendo un mensaje de éxito por archivo.

Antes de llamarlas, las funciones de midi_sequencer (y su dependencia de
tabla_emociones y patrones_bateria) quedan definidas vía el import de abajo.
"""

# import que define create_midi / export_stems (y todo lo que necesitan)
from midi_sequencer import export_stems

EMOCIONES = ["tristeza", "ira", "amor", "decepcion", "nostalgia"]  # las 5 de ESCALAS
GENERO = "trap"
TEMPO = 140
PREFIJO = "midi/trap"   # directorio 'midi' + prefijo 'trap' en los nombres


def main():
    total = 0
    for emocion in EMOCIONES:                          # 1 bloque por emoción
        archivos = export_stems(emocion, GENERO, TEMPO, output_prefix=PREFIJO)
        for ruta in archivos:
            print(f"[OK] Exportado: {ruta}")           # éxito por cada archivo
            total += 1
    print(f"\nSe generaron {total} archivos MIDI en total.")


if __name__ == "__main__":
    main()                                             # se ejecuta al correr el script
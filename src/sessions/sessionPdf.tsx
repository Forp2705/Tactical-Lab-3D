import { catalog } from "@/data";
import type { Session } from "@/data";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";

export async function exportSessionPdf(
  blocks: Session["blocks"],
  computed: NonNullable<Session["computed"]>,
) {
  const styles = StyleSheet.create({
    page: {
      padding: 28,
      fontSize: 11,
      fontFamily: "Helvetica",
      backgroundColor: "#071019",
      color: "#eff7fa",
    },
    title: { fontSize: 20, marginBottom: 12, color: "#c7df5f" },
    block: {
      padding: 10,
      border: "1 solid #31525d",
      borderRadius: 8,
      marginBottom: 8,
    },
    section: { marginTop: 12 },
    label: { color: "#5eead4", marginBottom: 4 },
  });

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Sesion RomboIQ</Text>
        <Text>Duración total: {computed.totalDuration} min</Text>
        <Text>Carga estimada: {computed.totalLoad}</Text>
        <View style={styles.section}>
          <Text style={styles.label}>Objetivos primarios</Text>
          {computed.primaryObjectives.map((objective: string) => (
            <Text key={objective}>• {objective}</Text>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.label}>Bloques</Text>
          {blocks.map((block: Session["blocks"][number], index: number) => {
            const exercise = catalog.find((item) => item.id === block.exerciseId);
            return (
              <View key={block.id} style={styles.block}>
                <Text>
                  {index + 1}. {exercise?.title ?? block.exerciseId} -{" "}
                  {block.durationMin} min
                </Text>
                <Text>{exercise?.objective.primary}</Text>
              </View>
            );
          })}
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "sesion-romboiq.pdf";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

{{/*
Expand the name of the chart.
*/}}
{{- define "avatar-web.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "avatar-web.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "avatar-web.labels" -}}
helm.sh/chart: {{ include "avatar-web.name" . }}-{{ .Chart.Version | replace "+" "_" }}
{{ include "avatar-web.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "avatar-web.selectorLabels" -}}
app.kubernetes.io/name: {{ include "avatar-web.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Database URL from secret or values
*/}}
{{- define "avatar-web.databaseUrl" -}}
{{- $host := .Values.postgresql.host }}
{{- $port := .Values.postgresql.port | default 5432 }}
{{- $db := .Values.postgresql.database }}
{{- $user := .Values.postgresql.user }}
{{- printf "postgresql://%s:$(DATABASE_PASSWORD)@%s:%d/%s" $user $host (int $port) $db }}
{{- end }}

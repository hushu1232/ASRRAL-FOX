/**
 * GPU-side chroma key shader for AstralFox transparent window.
 *
 * Replaces the CPU per-pixel chroma key loop in TransparentWindow.PerPixelAlphaLoop()
 * with a GPU blit pass. Renders magenta (1,0,1) as alpha=0, all other colors as alpha=1.
 * Output goes to a separate RenderTexture whose alpha channel feeds DWM UpdateLayeredWindow.
 *
 * Usage: Applied via ChromaKeyRenderFeature.cs as a URP ScriptableRendererFeature.
 */
Shader "Hidden/AstralFox/ChromaKey"
{
    Properties
    {
        _MainTex ("Source", 2D) = "white" {}
        _ChromaColor ("Chroma Key Color", Color) = (1, 0, 1, 1)
        _Tolerance ("Tolerance", Range(0, 2)) = 0.5
        _Softness ("Softness", Range(0, 1)) = 0.1
    }
    SubShader
    {
        Tags
        {
            "RenderType" = "Transparent"
            "RenderPipeline" = "UniversalPipeline"
        }

        Cull Off
        ZWrite Off
        ZTest Always

        Pass
        {
            Name "ChromaKey"
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag

            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes
            {
                float4 vertex : POSITION;
                float2 uv     : TEXCOORD0;
            };

            struct Varyings
            {
                float4 vertex : SV_POSITION;
                float2 uv     : TEXCOORD0;
            };

            TEXTURE2D(_MainTex);
            SAMPLER(sampler_MainTex);

            CBUFFER_START(UnityPerMaterial)
            float4 _MainTex_ST;
            half4 _ChromaColor;
            half _Tolerance;
            half _Softness;
            CBUFFER_END

            Varyings vert(Attributes IN)
            {
                Varyings OUT;
                OUT.vertex = TransformObjectToHClip(IN.vertex.xyz);
                OUT.uv = IN.uv * _MainTex_ST.xy + _MainTex_ST.zw;
                return OUT;
            }

            half4 frag(Varyings IN) : SV_Target
            {
                half4 col = SAMPLE_TEXTURE2D(_MainTex, sampler_MainTex, IN.uv);

                // Compute distance from chroma key color in RGB space
                half3 diff = abs(col.rgb - _ChromaColor.rgb);
                half dist = max(max(diff.r, diff.g), diff.b);

                // Soft edge: smooth transition around tolerance boundary
                half alpha = smoothstep(_Tolerance, _Tolerance + _Softness, dist);

                return half4(col.rgb, alpha);
            }
            ENDHLSL
        }
    }
}

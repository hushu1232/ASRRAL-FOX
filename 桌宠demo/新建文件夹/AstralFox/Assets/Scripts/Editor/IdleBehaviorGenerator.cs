using UnityEditor;
using UnityEngine;
using AstralFox.Animation;

namespace AstralFox.Editor
{
    public static class IdleBehaviorGenerator
    {
        private const string OutputDir = "Assets/Settings/IdleBehaviors";

        [MenuItem("Tools/AstralFox/Generate Idle Behavior Assets")]
        public static void GenerateAll()
        {
            if (!AssetDatabase.IsValidFolder(OutputDir))
                AssetDatabase.CreateFolder("Assets/Settings", "IdleBehaviors");

            int count = 0;
            count += Make("Scratch", 1.5f, 1.6f, t => { float p=t*8f, e=Mathf.Sin(t*Mathf.PI); return (e*5f, 0,0, 0,0,0, Mathf.Sin(p*5f)*.3f, 0, Mathf.Sin(p*3f)*.2f, 0,0, 0,0, 1,1); });
            count += Make("Stretch", 2.5f, 1.2f, t => { float v=Mathf.Clamp01(t), lb=v<.3f?(v/.3f)*4f:(v<.5f?4f:(1-(v-.5f)/.5f)*4f), fs=v<.5f?0:Mathf.Sin((v-.5f)/.5f*Mathf.PI)*.6f; return (-lb+fs*3f, Mathf.Sin(v*Mathf.PI)*2f,0, 0,0,0, 0,0, 0,0,v*.8f, fs,fs, Mathf.Lerp(1f,.4f,v*.7f), Mathf.Lerp(1f,.4f,v*.7f)); });
            count += Make("Sneeze", 0.5f, 0.8f, t => { float i=t<.4f?t/.4f*.3f:(t<.6f?1:Mathf.Lerp(1,0,(t-.6f)/.4f)), s=Mathf.Sin(t*15)*i*3; return (10*i-s, 0,0, s,0,0, -.5f*i,-.5f*i, i*.5f,0,0, 0,0, Mathf.Lerp(1,.1f,i), Mathf.Lerp(1,.1f,i)); });
            count += Make("LookAround", 2f, 1.3f, t => { float sw=Mathf.Sin(t*Mathf.PI*2)*4, e=Mathf.Cos(t*Mathf.PI*1.4f)*.25f; return (0, sw*.3f,0, 0,sw,Mathf.Sin(t*Mathf.PI*1.7f)*1.5f, e,-e, 0,0,0, 0,0, 1,1); });
            count += Make("ChaseTail", 2.5f, .6f, t => { float s=Mathf.Sin(t*4*Mathf.PI*2)*6, e=Mathf.Sin(t*Mathf.PI); return (0, Mathf.Cos(t*4*Mathf.PI*2)*4*e, s*e, 0,0,-s*.4f*e, 0,0, e*.4f,Mathf.Sin(t*6*Mathf.PI*2)*e,0, 0,0, 1,1); });
            count += Make("ShakeBody", 1f, 1f, t => { float e=Mathf.Sin(t*Mathf.PI), s=Mathf.Sin(t*12*Mathf.PI*2)*e; return (0,0,s*4, 0,0,s*2, s*.3f,s*.3f, e*.8f+s*.5f,0,0, s*.4f,s*.4f, 1,1); });
            count += Make("Nuzzle", 1.5f, .9f, t => { float n=Mathf.Sin(t*Mathf.PI)*.5f; return (n*3f,0,0, 0,0,0, 0,0, 0,0,0, Mathf.Sin(t*Mathf.PI*2)*.4f,0, Mathf.Lerp(1,.5f,Mathf.Sin(t*Mathf.PI)), Mathf.Lerp(1,.5f,Mathf.Sin(t*Mathf.PI))); });
            count += Make("TiltHead", 1.2f, 1.1f, t => { float ti=Mathf.Sin(t*Mathf.PI*2)*8, ev=Mathf.Abs(Mathf.Sin(t*Mathf.PI)); return (0,0,0, 0,0,ti, ev*.6f,ev*.6f, 0,0,0, 0,0, 1,1); });
            count += Make("Bounce", 1.5f, 1f, t => { float b=Mathf.Abs(Mathf.Sin(t*Mathf.PI*2))*Mathf.Clamp01(1-t); return (0,b*1.5f,0, 0,0,0, b*.3f,0, b*.8f,0,0, 0,0, 1,1); });
            count += Make("WavePaw", 1.5f, .7f, t => { float w=Mathf.Sin(t*Mathf.PI*3)*Mathf.Sin(t*Mathf.PI); return (0,0,0, 0,0,0, 0,0, Mathf.Sin(t*Mathf.PI)*.7f,0,0, w*.6f+.3f,0, .6f,.6f); });
            count += Make("FlopEars", 1.5f, 1f, t => { float c=Mathf.Sin(t*Mathf.PI*6), e=Mathf.Sin(t*Mathf.PI); return (0,0,0, 0,0,0, -.5f+c*.4f*e,-.5f+c*.4f*e, e*.3f,0,0, 0,0, 1,1); });
            count += Make("Wiggle", 1.5f, 1.2f, t => { float w=Mathf.Sin(t*Mathf.PI*4)*Mathf.Sin(t*Mathf.PI); return (0,w*2,w*5, 0,0,0, Mathf.Abs(w)*.5f,Mathf.Abs(w)*.5f, Mathf.Abs(w)*.9f,0,0, 0,0, 1,1); });

            AssetDatabase.Refresh();
            Debug.Log($"[IdleBehaviorGenerator] Generated {count} IdleBehaviorDef assets to {OutputDir}/");
        }

        private static int Make(string name, float duration, float weight,
            System.Func<float, (float bx,float by,float bz, float hx,float hy,float hz, float el,float er, float tw,float ts,float tc, float al,float ar, float eyl,float eyr)> gen)
        {
            var asset = ScriptableObject.CreateInstance<IdleBehaviorDef>();
            asset.behaviorName = name;
            asset.duration = duration;
            asset.weight = weight;

            int n = 60;
            var k = new Keyframe[n][];
            for (int j = 0; j < 15; j++) k[j] = new Keyframe[n];
            for (int i = 0; i < n; i++)
            {
                float t = (float)i / (n - 1);
                var v = gen(t);
                float[] vals = { v.bx,v.by,v.bz, v.hx,v.hy,v.hz, v.el,v.er, v.tw,v.ts,v.tc, v.al,v.ar, v.eyl,v.eyr };
                for (int j = 0; j < 15; j++) k[j][i] = new Keyframe(t, vals[j]);
            }
            asset.bodyAngleX=new AnimationCurve(k[0]); asset.bodyAngleY=new AnimationCurve(k[1]); asset.bodyAngleZ=new AnimationCurve(k[2]);
            asset.headAngleX=new AnimationCurve(k[3]); asset.headAngleY=new AnimationCurve(k[4]); asset.headAngleZ=new AnimationCurve(k[5]);
            asset.earL=new AnimationCurve(k[6]); asset.earR=new AnimationCurve(k[7]);
            asset.tailWag=new AnimationCurve(k[8]); asset.tailSwing=new AnimationCurve(k[9]); asset.tailCurl=new AnimationCurve(k[10]);
            asset.armL=new AnimationCurve(k[11]); asset.armR=new AnimationCurve(k[12]);
            asset.eyeLOpen=new AnimationCurve(k[13]); asset.eyeROpen=new AnimationCurve(k[14]);

            AssetDatabase.CreateAsset(asset, $"{OutputDir}/Idle_{name}.asset");
            return 1;
        }
    }
}
